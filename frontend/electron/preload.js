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
})
