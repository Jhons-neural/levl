import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseUsage, readCredentials, fetchClaude } from '../src/main/sources/claude.js';

const fx = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'levl-'));
const credPath = join(dir, 'cred.json');
const now = Date.parse('2026-11-21T18:00:00Z');
writeFileSync(credPath, JSON.stringify({ claudeAiOauth: { accessToken: 'tok', expiresAt: now + 3600_000, subscriptionType: 'pro' } }));
const okFetch = (body, status = 200) => async () => ({ ok: status < 300, status, json: async () => body });

test('parseUsage maps 5h, week and per-model week', () => {
  const { limits } = parseUsage(fx('usage-ok.json'));
  assert.deepEqual(limits.map((l) => [l.id, l.label, l.remaining]), [
    ['five_hour', '5 horas', 36], ['seven_day', 'semana', 34], ['seven_day_opus', 'semana · opus', 20],
  ]);
  assert.equal(limits[0].resetsAt, '2026-11-21T21:00:00.000Z');
});
test('parseUsage handles partial body and fraction utilization', () => {
  const { limits } = parseUsage(fx('usage-partial.json'));
  assert.equal(limits.length, 1);
  assert.equal(limits[0].remaining, 58);
  assert.equal(limits[0].resetsAt, null);
});
test('parseUsage clamps out-of-range utilization', () => {
  const { limits } = parseUsage({ five_hour: { utilization: 130, resets_at: null }, seven_day: { utilization: -4, resets_at: null } });
  assert.deepEqual(limits.map((l) => l.remaining), [0, 100]);
});
test('parseUsage on empty body returns null', () => {
  assert.equal(parseUsage({}), null);
});
test('readCredentials returns token and capitalised plan', () => {
  assert.deepEqual(readCredentials(credPath), { token: 'tok', expiresAt: now + 3600_000, plan: 'Pro' });
});
test('readCredentials on missing or bad file → null', () => {
  assert.equal(readCredentials(join(dir, 'nope.json')), null);
  const bad = join(dir, 'bad.json'); writeFileSync(bad, '{not json');
  assert.equal(readCredentials(bad), null);
  const empty = join(dir, 'empty.json'); writeFileSync(empty, '{}');
  assert.equal(readCredentials(empty), null);
});
test('fetchClaude ok', async () => {
  const r = await fetchClaude({ credentialsPath: credPath, fetchImpl: okFetch(fx('usage-ok.json')), now });
  assert.equal(r.ok, true);
  assert.equal(r.plan, 'Pro');
  assert.equal(r.limits[0].remaining, 36);
  assert.equal(r.at, now);
});
test('fetchClaude sends token only to anthropic with beta header', async () => {
  let seen;
  await fetchClaude({ credentialsPath: credPath, fetchImpl: async (url, opt) => { seen = { url, opt }; return okFetch(fx('usage-ok.json'))(); }, now });
  assert.equal(seen.url, 'https://api.anthropic.com/api/oauth/usage');
  assert.equal(seen.opt.headers.Authorization, 'Bearer tok');
  assert.equal(seen.opt.headers['anthropic-beta'], 'oauth-2025-04-20');
});
test('fetchClaude error reasons', async () => {
  const f = (impl, path = credPath) => fetchClaude({ credentialsPath: path, fetchImpl: impl, now });
  assert.deepEqual(await f(okFetch({}, 401)), { ok: false, reason: 'http-401' });
  assert.deepEqual(await f(async () => { throw new Error('x'); }), { ok: false, reason: 'network' });
  assert.deepEqual(await f(okFetch({})), { ok: false, reason: 'bad-shape' });
  assert.deepEqual(await f(okFetch({}), join(dir, 'nope.json')), { ok: false, reason: 'no-credentials' });
});
test('fetchClaude with expired token does not call the network', async () => {
  const p = join(dir, 'exp.json');
  writeFileSync(p, JSON.stringify({ claudeAiOauth: { accessToken: 't', expiresAt: now - 1 } }));
  let called = false;
  const r = await fetchClaude({ credentialsPath: p, fetchImpl: async () => { called = true; }, now });
  assert.deepEqual(r, { ok: false, reason: 'expired' });
  assert.equal(called, false);
});
test('parseUsage rounds resetsAt to the minute so jitter between polls keeps one window key', () => {
  const a = parseUsage({ five_hour: { utilization: 10, resets_at: '2026-11-21T20:59:59.908158+00:00' } });
  const b = parseUsage({ five_hour: { utilization: 11, resets_at: '2026-11-21T20:59:59.877743+00:00' } });
  assert.equal(a.limits[0].resetsAt, '2026-11-21T21:00:00.000Z');
  assert.equal(a.limits[0].resetsAt, b.limits[0].resetsAt);
});
