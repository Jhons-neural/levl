// Settings persisted as JSON in the app's userData dir; written atomically.
import { readFileSync, writeFileSync, renameSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULTS = Object.freeze({
  look: 'linha', opacity: 1, length: 240, showLabel: true, onTop: true, clickThrough: false,
  locked: false, alertLow: true, alertRefill: true, autostart: true,
  hotkey: 'Control+Alt+L', clickHotkey: 'Control+Alt+K',
  pos: null, alertMemory: {}, samples: {},
  digest: true, digestHour: 18, paceAlert: true, analysisModel: 'sonnet', lastDigest: null, lastPaceWeek: null,
});
const LOOKS = ['linha', 'grafite', 'nevoa'];
const clamp = (v, lo, hi, d) => (typeof v === 'number' && !Number.isNaN(v) ? Math.min(hi, Math.max(lo, v)) : d);

function sanitize(raw) {
  const s = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) if (raw?.[k] !== undefined) s[k] = raw[k];
  s.opacity = clamp(s.opacity, 0.3, 1, DEFAULTS.opacity);
  s.length = Math.round(clamp(s.length, 120, 420, DEFAULTS.length));
  if (!LOOKS.includes(s.look)) s.look = DEFAULTS.look;
  s.digestHour = Math.round(clamp(s.digestHour, 0, 23, DEFAULTS.digestHour));
  if (!['sonnet', 'opus'].includes(s.analysisModel)) s.analysisModel = DEFAULTS.analysisModel;
  for (const k of ['showLabel', 'onTop', 'clickThrough', 'locked', 'alertLow', 'alertRefill', 'autostart', 'digest', 'paceAlert'])
    if (typeof s[k] !== 'boolean') s[k] = DEFAULTS[k];
  return s;
}

export function loadSettings(dir) {
  const file = join(dir, 'settings.json');
  if (!existsSync(file)) return { ...DEFAULTS };
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return { ...DEFAULTS }; // locked or unreadable: run on defaults rather than crash
  }
  text = text.replace(/^\uFEFF/, ''); // editors/PowerShell may add a BOM
  try {
    return sanitize(JSON.parse(text));
  } catch {
    writeFileSync(join(dir, 'settings.bad.json'), text);
    return { ...DEFAULTS };
  }
}

export function saveSettings(dir, partial) {
  const s = sanitize({ ...loadSettings(dir), ...partial });
  const file = join(dir, 'settings.json');
  try {
    writeFileSync(file + '.tmp', JSON.stringify(s, null, 2));
    renameSync(file + '.tmp', file);
  } catch (e) {
    // shortcut: a locked file (antivirus/OneDrive) skips this write; the next save retries.
    console.warn('[levl] settings not saved:', e.code);
    try { rmSync(file + '.tmp', { force: true }); } catch { /* nothing to clean */ }
  }
  return s;
}
