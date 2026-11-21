// Narrow bridge between sandboxed renderers and the main process. No token ever crosses it.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('levl', {
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
  ready: () => ipcRenderer.send('ready'),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragMove: () => ipcRenderer.send('drag-move'),
  dragEnd: () => ipcRenderer.send('drag-end'),
  togglePopup: () => ipcRenderer.send('toggle-popup'),
  openSettings: () => ipcRenderer.send('open-settings'),
  setSettings: (partial) => ipcRenderer.invoke('set-settings', partial),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  refresh: () => ipcRenderer.send('refresh'),
  installUpdate: () => ipcRenderer.send('install-update'),
  closeWindow: () => ipcRenderer.send('close-self'),
  openLeitor: () => ipcRenderer.send('open-leitor'),
  runAnalysis: () => ipcRenderer.invoke('analysis-run'),
  lastAnalysis: () => ipcRenderer.invoke('analysis-last'),
  openLink: (url) => ipcRenderer.send('open-link', url),
});
