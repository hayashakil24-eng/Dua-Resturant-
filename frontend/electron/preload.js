import { contextBridge, ipcRenderer } from 'electron'

// discoverServer() is the renderer's only privileged API so far — it needs
// main.js's UDP dgram socket (unavailable in the browser sandbox) to find the
// local server's IP without a staff member typing it in (see main.js and
// docs/04-phase-3-deployment-hardening.md). Everything else the
// renderer needs (reads/writes) still goes through localStorage/fetch, no
// nodeIntegration, contextIsolation stays on.
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  discoverServer: () => ipcRenderer.invoke('discover-server'),
  // Silent receipt printing (main.js) — src/utils/print.js's safePrint() uses
  // these instead of window.print() so no Chromium print dialog ever shows.
  // listPrinters is read-only enumeration for the Settings picker; printSilent
  // takes only a printer NAME already returned by listPrinters, never raw
  // print options — the renderer can't reach webContents.print() directly.
  listPrinters: () => ipcRenderer.invoke('list-printers'),
  printSilent: (deviceName) => ipcRenderer.invoke('print-silent', { deviceName }),
  // Auto-update (main.js's autoUpdater) — the background/scheduled checks
  // only ever tell the renderer about a *found* update (a failed/offline
  // check there is deliberately silent, see main.js). checkForUpdatesNow and
  // the checking/not-available/error listeners exist only for the manual
  // "Check for Updates Now" button in Settings, which does need that
  // feedback — nothing else in the app listens for them.
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_e, data) => callback(data)),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (_e, data) => callback(data)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_e, data) => callback(data)),
  onUpdateChecking: (callback) => ipcRenderer.on('update-checking', () => callback()),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (_e, data) => callback(data)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_e, data) => callback(data)),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  checkForUpdatesNow: () => ipcRenderer.invoke('check-for-updates-now'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
})
