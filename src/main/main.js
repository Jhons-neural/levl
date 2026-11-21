// Levl main process: owns the token, polling, windows, tray and hotkeys.
import { app, BrowserWindow, Tray, Menu, ipcMain, screen, globalShortcut, nativeImage, Notification, shell } from 'electron';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadSettings, saveSettings } from './settings.js';
import { dock, clampToWorkArea } from './dock.js';
import { forecast } from './forecast.js';
import { alertsToFire } from './alerts.js';
import { fetchClaude } from './sources/claude.js';
import { initUpdates, checkForUpdates, installUpdate } from './updates.js';
import { serial } from './serial.js';
import { scanAll } from './usage/scan.js';
import { computeInsights } from './usage/insights.js';
import { buildSummary } from './usage/summary.js';
import { shouldDigest, shouldPaceAlert, digestMessage } from './usage/digest.js';
import { runAnalysis, buildPrompt } from './analyze.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const R = (...p) => join(ROOT, ...p);
const CRED = join(homedir(), '.claude', '.credentials.json');
const MIN = 60_000;
const THIN = 40; // meter window thickness (px), fits bulb + label
const POLL_MS = 2 * MIN, SLOW_MS = 10 * MIN, MIN_GAP_MS = 30_000, SCAN_MS = 10 * MIN;
const LOGS = join(homedir(), '.claude', 'projects');
const CACHE_V = 3;
const CLAUDE_EXE = join(homedir(), '.local', 'bin', 'claude.exe');

const primary = app.requestSingleInstanceLock();
if (!primary) app.exit(0); // a second launch only wakes the running one (second-instance below)
app.setAppUserModelId('com.jhon.levl');

let dataDir, s, meter, popup, settingsWin, leitorWin, tray;
let usageRows = [], usageCache = {}, analysisRunning = false;
let popupClosedAt = 0, dragOffset = null, pollTimer = null, lastPoll = 0, errors = 0;
const state = { ok: false, stale: true, reason: 'loading', plan: null, limits: [], at: null, updateReady: false };

// ---------- state ----------
function viewState() {
  const now = Date.now();
  const limits = state.limits.map((l) => {
    const pts = s.samples[l.id]?.points ?? [];
    const win = l.id === 'five_hour' ? 30 * MIN : 24 * 60 * MIN;
    return { ...l, forecast: l.demoForecast ?? (l.resetsAt ? forecast(pts, Date.parse(l.resetsAt), now, win) : null) };
  });
  return {
    ...state, limits, now,
    look: s.look, opacity: s.opacity, showLabel: s.showLabel, length: s.length, clickThrough: s.clickThrough,
    locked: s.locked, orientation: s.pos?.orientation ?? 'h', version: app.getVersion(),
    settings: { ...s, samples: undefined, alertMemory: undefined, pos: undefined },
    insights: process.env.LEVL_DEMO ? DEMO_INSIGHTS : usageRows.length ? computeInsights(usageRows, state.limits, now) : null,
    analysisRunning,
  };
}
function broadcast() {
  const v = viewState();
  for (const w of [meter, popup, settingsWin, leitorWin]) if (w && !w.isDestroyed()) w.webContents.send('state', v);
  updateTray();
}

// ---------- polling ----------
function recordSamples(limits, at) {
  for (const l of limits) {
    const prev = s.samples[l.id];
    const keep = prev && prev.resetsAt === l.resetsAt ? prev.points.filter((p) => p.t > at - 26 * 60 * MIN) : [];
    s.samples[l.id] = { resetsAt: l.resetsAt, points: [...keep, { t: at, used: 100 - l.remaining }] };
  }
}

function runAlerts(limits) {
  const now = Date.now();
  for (const l of limits) {
    const { fire, memory } = alertsToFire(l, s.alertMemory[l.id], now);
    s.alertMemory[l.id] = memory;
    for (const kind of fire) {
      if (kind === 'low' && !s.alertLow) continue;
      if (kind === 'refill' && !s.alertRefill) continue;
      const title = kind === 'low' ? `Levl · ${l.label} com ${l.remaining}%` : `Levl · ${l.label} renovado`;
      const body = kind === 'low' ? `Volta às ${fmtReset(l.resetsAt)}` : 'Limite cheio de novo';
      new Notification({ title, body, icon: R('assets', 'levl-64.png') }).show();
    }
  }
}

function fmtReset(iso) {
  if (!iso) return '—';
  const d = new Date(iso), today = new Date();
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === today.toDateString() ? hm : `${d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')} ${hm}`;
}

// dev-only (LEVL_DEMO): fixed sample numbers for screenshots, no network, no real project names.
const DEMO_INSIGHTS = {
  windowStart: 0, weekUsedPct: 42, week: { deltaPct: 18 }, day: { deltaPct: 35 },
  top: [{ project: 'app-da-loja', pct: 46 }, { project: 'site-cliente', pct: 24 }, { project: 'automacoes', pct: 15 }, { project: 'estudos', pct: 9 }, { project: 'Outros', pct: 6 }],
  tips: ['Conversas muito longas em app-da-loja (412k): use /clear ou /compact entre tarefas.', '72% do consumo foi no Opus: use o Sonnet para tarefas simples.'],
};
function demoUsage() {
  const now = Date.now(), H = 3_600_000, iso = (t) => new Date(Math.round(t / 60_000) * 60_000).toISOString();
  return { ok: true, plan: 'Pro', at: now, limits: [
    { id: 'five_hour', label: '5 horas', remaining: Number(process.env.LEVL_DEMO_PCT ?? 64), resetsAt: iso(now + 3.4 * H), demoForecast: { lasts: true } },
    { id: 'seven_day', label: 'semana', remaining: 58, resetsAt: iso(now + 110 * H), demoForecast: { lasts: false, endsAt: now + 94 * H } },
  ] };
}

// One poll at a time; always reschedules, even if something inside throws.
const poll = serial(async () => {
  clearTimeout(pollTimer);
  lastPoll = Date.now();
  try {
    const fake = Number(process.env.LEVL_FAKE);
    const r = process.env.LEVL_DEMO ? demoUsage() : await fetchClaude({ credentialsPath: CRED });
    if (r.ok && !Number.isNaN(fake) && process.env.LEVL_FAKE) r.limits[0].remaining = fake; // dev-only override
    if (r.ok) {
      errors = 0;
      Object.assign(state, { ok: true, stale: false, reason: null, plan: r.plan, limits: r.limits, at: r.at });
      if (process.env.LEVL_DEMO) return; // demo numbers never touch saved samples or alerts
      recordSamples(r.limits, r.at);
      runAlerts(r.limits);
      runDigest();
      s = saveSettings(dataDir, { samples: s.samples, alertMemory: s.alertMemory });
    } else {
      errors++;
      Object.assign(state, { ok: false, stale: true, reason: r.reason });
    }
    broadcast();
  } catch (e) {
    errors++;
    console.warn('[levl] poll failed:', e?.message);
  } finally {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(poll, errors >= 3 || state.reason === 'http-429' ? SLOW_MS : POLL_MS); // back off at once when rate-limited
  }
});
const pollSoon = () => { if (Date.now() - lastPoll >= MIN_GAP_MS) poll(); };

// ---------- usage reader ----------
const readJson = (f, d) => { try { return JSON.parse(readFileSync(join(dataDir, f), 'utf8')); } catch { return d; } };
const writeJson = (f, v) => { try { writeFileSync(join(dataDir, f), JSON.stringify(v)); } catch (e) { console.warn('[levl] write', f, e.code); } };

const scanUsage = serial(async () => {
  try {
    const r = await scanAll({ root: LOGS, cache: usageCache });
    usageRows = r.rows;
    usageCache = r.cache;
    writeJson('usage-cache.json', { v: CACHE_V, files: usageCache });
    runDigest();
    broadcast();
  } catch (e) {
    console.warn('[levl] scan failed:', e?.message);
  }
});

function runDigest() {
  if (!usageRows.length || !state.ok) return;
  const now = Date.now();
  const i = computeInsights(usageRows, state.limits, now);
  const wk = state.limits.find((l) => l.id === 'seven_day');
  const icon = R('assets', 'levl-64.png');
  const weekKey = String(i.windowStart);
  if (s.paceAlert && shouldPaceAlert(i.week.deltaPct, weekKey, s.lastPaceWeek, 30)) {
    new Notification({ title: `Levl · ritmo ${i.week.deltaPct > 0 ? '+' : ''}${i.week.deltaPct}% vs semana passada`, body: `Semana em ${i.weekUsedPct ?? '?'}% · volta ${fmtReset(wk?.resetsAt)}${i.top[0] ? ` · ${i.top[0].project} lidera` : ''}`, icon }).show();
    s = saveSettings(dataDir, { lastPaceWeek: weekKey });
  }
  if (s.digest && i.weekUsedPct != null && shouldDigest(now, s.lastDigest, s.digestHour, i.day.a > 0)) {
    const m = digestMessage({ weekUsedPct: i.weekUsedPct, resetLabel: fmtReset(wk?.resetsAt), day: i.day, week: i.week, top: i.top[0]?.project, now });
    new Notification({ ...m, icon }).show();
    s = saveSettings(dataDir, { lastDigest: new Date(now).toDateString() });
  }
}

// ---------- Leitor + analysis ----------
function openLeitor() {
  popup?.close();
  if (leitorWin && !leitorWin.isDestroyed()) return leitorWin.focus();
  leitorWin = new BrowserWindow({
    width: 480, height: 680, frame: false, resizable: true, minWidth: 420, minHeight: 520, show: false,
    backgroundColor: '#00000000', backgroundMaterial: 'acrylic', title: 'Levl · Leitor', icon: R('build', 'icon.png'),
    webPreferences: { preload: R('src', 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  leitorWin.loadFile(R('src', 'renderer', 'leitor.html'));
  leitorWin.once('ready-to-show', () => leitorWin.show());
  leitorWin.on('closed', () => { leitorWin = null; });
  scanUsage();
}

const fiveUsed = () => { const l = state.limits.find((x) => x.id === 'five_hour'); return l ? 100 - l.remaining : null; };

async function analyze() {
  if (analysisRunning) return { ok: false, reason: 'busy' };
  analysisRunning = true;
  broadcast();
  try {
    await scanUsage();
    await poll();
    const before = fiveUsed();
    const now = Date.now();
    const i = computeInsights(usageRows, state.limits, now);
    const summary = buildSummary({ rows: usageRows, windowStart: i.windowStart, now, plan: state.plan, limits: state.limits });
    const cwd = join(tmpdir(), 'levl-analise');
    mkdirSync(cwd, { recursive: true });
    const r = await runAnalysis({ prompt: buildPrompt(summary), model: s.analysisModel, cwd, claudeCmd: existsSync(CLAUDE_EXE) ? CLAUDE_EXE : 'claude' });
    if (!r.ok) return r;
    lastPoll = 0;
    await poll();
    const after = fiveUsed();
    const saved = { at: Date.now(), model: s.analysisModel, markdown: r.markdown, costPct: before != null && after != null ? Math.max(0, after - before) : null };
    writeJson('analysis.json', saved);
    return { ok: true, ...saved };
  } finally {
    analysisRunning = false;
    broadcast();
  }
}

// ---------- meter window ----------
function meterSize(orientation) {
  const long = s.length + 96; // room for the label, including "esgotado"
  return orientation === 'v' ? { width: THIN, height: long } : { width: long, height: THIN };
}

function restoreBounds() {
  const o = s.pos?.orientation ?? 'h';
  const size = meterSize(o);
  const disp = screen.getAllDisplays().find((d) => d.id === s.pos?.displayId);
  if (disp && s.pos) return { ...size, ...clampToWorkArea({ ...size, x: s.pos.x, y: s.pos.y }, disp.workArea) };
  const wa = screen.getPrimaryDisplay().workArea; // fallback: primary bottom-right
  return { ...size, x: wa.x + wa.width - size.width - 24, y: wa.y + wa.height - size.height - 8 };
}

function createMeter() {
  meter = new BrowserWindow({
    ...restoreBounds(),
    frame: false, transparent: true, resizable: false, skipTaskbar: true, hasShadow: false,
    maximizable: false, minimizable: false, fullscreenable: false, focusable: true, show: false,
    alwaysOnTop: s.onTop, backgroundColor: '#00000000',
    webPreferences: { preload: R('src', 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  meter.setOpacity(s.opacity);
  applyMouseMode();
  meter.loadFile(R('src', 'renderer', 'meter.html'));
  meter.once('ready-to-show', () => meter.showInactive());
}

// Fully transparent pixels already pass clicks through on Windows; only click-through mode ignores the tube too.
function applyMouseMode() {
  meter?.setIgnoreMouseEvents(s.clickThrough);
}

function finishDrag() {
  const b = meter.getBounds();
  const disp = screen.getDisplayMatching(b);
  const d = dock(b, disp.workArea, 8, s.pos?.orientation ?? 'h');
  meter.setBounds({ x: d.x, y: d.y, ...meterSize(d.orientation) });
  s = saveSettings(dataDir, { pos: { x: d.x, y: d.y, displayId: disp.id, orientation: d.orientation } });
  broadcast();
}

function resizeMeter() {
  const b = meter.getBounds();
  const size = meterSize(s.pos?.orientation ?? 'h');
  const disp = screen.getDisplayMatching(b);
  meter.setBounds({ ...size, ...clampToWorkArea({ ...size, x: b.x, y: b.y }, disp.workArea) });
}

// ---------- popup ----------
// Fixed, compact panel: only the meter grows with "Tamanho"; the popup never does.
const POPUP_ZOOM = 0.82;
const POPUP = { width: Math.round(340 * POPUP_ZOOM), height: Math.round(312 * POPUP_ZOOM) };
function popupBounds() {
  const m = meter.getBounds();
  const wa = screen.getDisplayMatching(m).workArea;
  const cx = m.x + m.width / 2, cy = m.y + m.height / 2, gap = 10;
  const o = s.pos?.orientation ?? 'h';
  let x, y;
  if (o === 'h') {
    x = cx - POPUP.width / 2;
    y = cy > wa.y + wa.height / 2 ? m.y - POPUP.height - gap : m.y + m.height + gap;
  } else {
    y = cy - POPUP.height / 2;
    x = cx > wa.x + wa.width / 2 ? m.x - POPUP.width - gap : m.x + m.width + gap;
  }
  return { ...POPUP, ...clampToWorkArea({ ...POPUP, x: Math.round(x), y: Math.round(y) }, wa) };
}

function togglePopup() {
  if (popup && !popup.isDestroyed()) return popup.close();
  if (Date.now() - popupClosedAt < 300) return; // the click that blurred it shouldn't reopen it
  popup = new BrowserWindow({
    ...popupBounds(),
    frame: false, transparent: true, resizable: false, skipTaskbar: true, hasShadow: false,
    alwaysOnTop: true, show: false, backgroundColor: '#00000000', backgroundMaterial: 'acrylic', roundedCorners: true,
    webPreferences: { preload: R('src', 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, zoomFactor: POPUP_ZOOM },
  });
  popup.loadFile(R('src', 'renderer', 'popup.html'));
  popup.once('ready-to-show', () => { popup.show(); popup.focus(); });
  popup.on('blur', () => popup && !popup.isDestroyed() && popup.close());
  popup.on('closed', () => { popup = null; popupClosedAt = Date.now(); });
  pollSoon();
}

// ---------- settings window ----------
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) return settingsWin.focus();
  settingsWin = new BrowserWindow({
    width: 440, height: 720, frame: false, resizable: false, maximizable: false, show: false,
    backgroundColor: '#00000000', backgroundMaterial: 'acrylic', title: 'Levl · Configurações', icon: R('build', 'icon.png'),
    webPreferences: { preload: R('src', 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  settingsWin.loadFile(R('src', 'renderer', 'settings.html'));
  settingsWin.once('ready-to-show', () => settingsWin.show());
  settingsWin.on('closed', () => { settingsWin = null; });
}

// ---------- settings apply ----------
function registerHotkeys(prev) {
  globalShortcut.unregisterAll();
  const errorsOut = {};
  for (const [key, fn] of [['hotkey', toggleMeter], ['clickHotkey', toggleClickThrough]]) {
    let okReg = false;
    try { okReg = globalShortcut.register(s[key], fn); } catch { okReg = false; }
    if (!okReg) {
      errorsOut[key] = 'atalho em uso';
      if (prev && prev[key] !== s[key]) {
        s = saveSettings(dataDir, { [key]: prev[key] });
        try { globalShortcut.register(s[key], fn); } catch { /* keep going without it */ }
      }
    }
  }
  return errorsOut;
}

function applySettings(prev) {
  meter.setOpacity(s.opacity);
  meter.setAlwaysOnTop(s.onTop);
  applyMouseMode();
  if (!prev || prev.length !== s.length) resizeMeter();
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: s.autostart });
  const errs = !prev || prev.hotkey !== s.hotkey || prev.clickHotkey !== s.clickHotkey ? registerHotkeys(prev) : {};
  broadcast();
  return errs;
}

function setSettings(partial) {
  const prev = s;
  s = saveSettings(dataDir, partial);
  return { errors: applySettings(prev), settings: viewState().settings };
}

const toggleMeter = () => (meter.isVisible() ? meter.hide() : meter.showInactive());
const toggleClickThrough = () => setSettings({ clickThrough: !s.clickThrough });

// ---------- tray ----------
function updateTray() {
  if (!tray) return;
  const pct = (id) => state.limits.find((l) => l.id === id)?.remaining;
  const h5 = pct('five_hour'), wk = pct('seven_day');
  let tip = state.ok ? `Levl · 5h ${h5}%` + (wk != null ? ` · semana ${wk}%` : '') : 'Levl · abra o Claude Code para atualizar';
  if (s.clickThrough) tip += ' · clique atravessa ligado';
  tray.setToolTip(tip);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mostrar/ocultar medidor', click: toggleMeter },
    { label: 'Travar posição', type: 'checkbox', checked: s.locked, click: () => setSettings({ locked: !s.locked }) },
    { label: 'Clique atravessa', type: 'checkbox', checked: s.clickThrough, click: toggleClickThrough },
    { label: 'Atualizar agora', click: poll },
    { label: 'Leitor', click: openLeitor },
    { label: 'Configurações', click: openSettings },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() },
  ]));
}

// ---------- IPC ----------
function wireIpc() {
  if (process.env.LEVL_DEBUG) console.log('[levl] debug on');
  if (process.env.LEVL_DEBUG) for (const ch of ['drag-start', 'drag-move', 'drag-end', 'toggle-popup']) ipcMain.on(ch, (_e, a) => console.log('[ipc]', ch, a ?? ''));
  ipcMain.on('ready', (e) => e.sender.send('state', viewState()));
  ipcMain.on('drag-start', () => {
    if (s.locked) return;
    const c = screen.getCursorScreenPoint(), b = meter.getBounds();
    dragOffset = { x: c.x - b.x, y: c.y - b.y, w: b.width, h: b.height };
  });
  ipcMain.on('drag-move', () => {
    if (!dragOffset) return;
    const c = screen.getCursorScreenPoint();
    meter.setBounds({ x: c.x - dragOffset.x, y: c.y - dragOffset.y, width: dragOffset.w, height: dragOffset.h });
  });
  ipcMain.on('drag-end', () => { if (dragOffset) { dragOffset = null; finishDrag(); } });
  ipcMain.on('toggle-popup', togglePopup);
  ipcMain.on('open-settings', () => { popup?.close(); openSettings(); });
  ipcMain.on('refresh', pollSoon);
  ipcMain.on('install-update', installUpdate);
  ipcMain.on('close-self', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
  ipcMain.handle('set-settings', (_e, partial) => setSettings(partial));
  ipcMain.handle('check-update', () => checkForUpdates());
  ipcMain.on('open-leitor', openLeitor);
  ipcMain.handle('analysis-run', () => analyze());
  ipcMain.handle('analysis-last', () => (process.env.LEVL_DEMO ? null : readJson('analysis.json', null)));
  ipcMain.on('open-link', (_e, url) => { if (String(url).startsWith('https://')) shell.openExternal(url); });
}

// ---------- lifecycle ----------
// Windows only show our own pages: block navigation (e.g. a file dropped on the meter) and popups.
app.on('web-contents-created', (_e, wc) => {
  wc.on('will-navigate', (ev) => ev.preventDefault());
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
});
app.on('second-instance', () => meter?.showInactive());
app.on('window-all-closed', () => { /* stay alive in tray */ });
app.on('will-quit', () => globalShortcut.unregisterAll());

if (primary) app.whenReady().then(() => {
  dataDir = app.getPath('userData');
  s = loadSettings(dataDir);
  if (process.env.LEVL_LOOK) s = { ...s, look: process.env.LEVL_LOOK }; // dev-only: preview a look without saving it
  wireIpc();
  createMeter();
  const img = nativeImage.createFromPath(R('assets', 'tray.png'));
  img.addRepresentation({ scaleFactor: 2, buffer: nativeImage.createFromPath(R('assets', 'tray@2x.png')).toPNG() });
  tray = new Tray(img);
  tray.on('click', toggleMeter);
  applySettings(null);
  initUpdates((ready) => { state.updateReady = ready; broadcast(); });
  for (const ev of ['display-removed', 'display-metrics-changed']) screen.on(ev, () => meter.setBounds(restoreBounds()));
  const c = readJson('usage-cache.json', null);
  usageCache = c?.v === CACHE_V ? c.files : {}; // bump CACHE_V when row parsing changes
  poll().then(scanUsage);
  setInterval(scanUsage, SCAN_MS);
  const open = { popup: togglePopup, leitor: openLeitor, settings: openSettings }[process.env.LEVL_OPEN]; // dev-only: open a window for visual checks
  if (open) setTimeout(open, 2500);
  if (process.env.LEVL_SHOTS) { // dev-only: save meter + popup images (with alpha) for README art
    const save = async (w, name) => writeFileSync(join(process.env.LEVL_SHOTS, name), (await w.webContents.capturePage()).toPNG());
    setTimeout(async () => { await save(meter, `meter-${s.look}.png`); togglePopup(); }, 5000);
    setTimeout(async () => { await save(popup, `popup-${s.look}.png`); openLeitor(); }, 7500);
    setTimeout(async () => { await save(leitorWin, `leitor-${s.look}.png`); app.quit(); }, 11000);
  }
});
