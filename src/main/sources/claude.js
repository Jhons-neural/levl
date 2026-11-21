// Claude plan usage via the endpoint Claude Code's /usage calls (unofficial — parse defensively).
// The token is read fresh each time and never refreshed or written (Claude Code owns it).
import { readFileSync } from 'node:fs';

export const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const LABELS = { five_hour: '5 horas', seven_day: 'semana' };

const clamp = (n) => Math.min(100, Math.max(0, n));
// The API's resets_at jitters by milliseconds between calls; round to the minute so one window has one key.
function roundReset(iso) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(Math.round(t / 60_000) * 60_000).toISOString();
}

export function parseUsage(json) {
  if (!json || typeof json !== 'object') return null;
  const ids = Object.keys(json).filter(
    (k) => (k === 'five_hour' || k.startsWith('seven_day')) && typeof json[k]?.utilization === 'number',
  );
  if (!ids.includes('five_hour')) return null;
  const used = ids.map((k) => json[k].utilization);
  // shortcut: guess 0–1 fractions if every value ≤ 1 and one isn't whole; drop once the API shape is stable.
  const scale = used.every((u) => u <= 1) && used.some((u) => !Number.isInteger(u)) ? 100 : 1;
  const order = (k) => (k === 'five_hour' ? 0 : k === 'seven_day' ? 1 : 2);
  const limits = ids.sort((a, b) => order(a) - order(b)).map((id) => ({
    id,
    label: LABELS[id] ?? `semana · ${id.replace('seven_day_', '').replace(/_/g, ' ')}`,
    remaining: Math.round(clamp(100 - json[id].utilization * scale)),
    resetsAt: json[id].resets_at ? roundReset(json[id].resets_at) : null,
  }));
  return { limits };
}

export function readCredentials(path) {
  try {
    const c = JSON.parse(readFileSync(path, 'utf8')).claudeAiOauth;
    if (!c?.accessToken) return null;
    const t = c.subscriptionType;
    return { token: c.accessToken, expiresAt: c.expiresAt, plan: t ? t[0].toUpperCase() + t.slice(1) : null };
  } catch {
    return null;
  }
}

export async function fetchClaude({ credentialsPath, fetchImpl = fetch, now = Date.now() }) {
  const cred = readCredentials(credentialsPath);
  if (!cred) return { ok: false, reason: 'no-credentials' };
  if (cred.expiresAt && cred.expiresAt <= now) return { ok: false, reason: 'expired' };
  let res;
  try {
    res = await fetchImpl(USAGE_URL, {
      headers: { Authorization: `Bearer ${cred.token}`, 'anthropic-beta': 'oauth-2025-04-20' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (!res.ok) return { ok: false, reason: `http-${res.status}` };
  let parsed;
  try {
    parsed = parseUsage(await res.json());
  } catch {
    parsed = null;
  }
  if (!parsed) return { ok: false, reason: 'bad-shape' };
  return { ok: true, plan: cred.plan, limits: parsed.limits, at: now };
}
