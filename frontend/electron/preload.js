import { contextBridge } from 'electron'

// Placeholder bridge — the renderer currently only reads/writes localStorage
// (see AppContext.jsx) and needs no privileged APIs yet. This exists so future
// features that do (local file storage, direct printer access, IPC to a local
// backend process) have a contextIsolation-safe place to add them, without the
// renderer ever getting raw Node/Electron access (nodeIntegration stays off).
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
})
