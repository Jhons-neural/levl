// Update notice: download in background, install only when the owner clicks.
import { app } from 'electron';
import pkg from 'electron-updater';

const { autoUpdater } = pkg;
const SIX_HOURS = 6 * 60 * 60_000;
// Feed = GitHub Releases of the owner's public repo Jhons-neural/levl-releases (free).
// Builds are unsigned, so whoever controls that repo controls updates: keep its access tight.
const FEED_LIVE = true;

export function initUpdates(onReady) {
  if (!app.isPackaged || !FEED_LIVE) return; // no feed in dev
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on('update-downloaded', () => onReady(true));
  autoUpdater.on('error', (e) => console.warn('[levl] update check failed:', e?.message));
  checkForUpdates();
  setInterval(checkForUpdates, SIX_HOURS);
}

export async function checkForUpdates() {
  if (!app.isPackaged) return { status: 'dev' };
  if (!FEED_LIVE) return { status: 'off' };
  try {
    const r = await autoUpdater.checkForUpdates();
    const latest = r?.updateInfo?.version;
    return { status: latest && latest !== app.getVersion() ? 'available' : 'current', version: latest ?? null };
  } catch {
    return { status: 'error' };
  }
}

// Silent install, then relaunch: the click is the consent, no wizard to babysit.
export const installUpdate = () => app.isPackaged && FEED_LIVE && autoUpdater.quitAndInstall(true, true);
