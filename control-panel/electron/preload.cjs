// CommonJS, not ESM: Electron's sandboxed preload execution context (sandbox:
// true in main.js's webPreferences) doesn't support `import` syntax regardless
// of the package.json "type": "module" setting — confirmed via a real
// preload-error event during dev testing ("Cannot use import statement
// outside a module"). The main POS app's preload.js hits the same rule but
// papers over it with a build step (vite-plugin-electron compiles it to CJS
// content under a .mjs extension — see its own file header); this app has no
// build step for the preload, so it's just written as CJS directly instead.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('controlPanel', {
  getSetupStatus: () => ipcRenderer.invoke('get-setup-status'),
  pickBackupFolder: () => ipcRenderer.invoke('pick-backup-folder'),
  runSetup: (opts) => ipcRenderer.invoke('run-setup', opts),
  unlockPanel: (password) => ipcRenderer.invoke('unlock-panel', password),
  getStatus: () => ipcRenderer.invoke('get-status'),
  startServer: () => ipcRenderer.invoke('start-server'),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  getDevices: () => ipcRenderer.invoke('get-devices'),
  disconnectDevice: (socketId) => ipcRenderer.invoke('disconnect-device', socketId),
  onStatusChanged: (callback) => ipcRenderer.on('status-changed', (_e, data) => callback(data)),
})
