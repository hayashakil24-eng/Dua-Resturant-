import { app, BrowserWindow, Menu, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import serve from 'electron-serve'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Serves the built renderer (dist/) over a custom app:// scheme in production.
// Absolute asset paths (e.g. menu images in mockData.js: '/Pina Colada.jfif')
// and react-router-dom's BrowserRouter both need a "real" static-file-server
// origin to resolve correctly — a raw file:// load would break both.
const loadProdApp = serve({ directory: path.join(__dirname, '../dist') })

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// The window/taskbar icon at runtime. In dev the built dist/ may be stale or
// missing, so read straight from public/ (Vite copies public/icon.png -> dist/
// icon.png verbatim, so the packaged app finds it there instead — public/
// itself isn't shipped in the packaged app, only dist/ is). This is separate
// from the .exe/installer icon, which electron-builder embeds at build/
// icons/win/icon.ico (see the "win.icon" field in package.json).
const iconPath = path.join(__dirname, VITE_DEV_SERVER_URL ? '../public/icon.png' : '../dist/icon.png')

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Cafe Ali',
    icon: iconPath,
    webPreferences: {
      // vite-plugin-electron builds the preload script as CJS content with a
      // .mjs extension when package.json has "type": "module" — Electron's
      // sandboxed preload loader doesn't use Node's normal ESM/CJS extension
      // rules, so this is its documented, correct output, not a mismatch.
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // External links (e.g. the "Send via WhatsApp" wa.me link in Reports.jsx)
  // must open in the system default browser, not a bare chromeless Electron
  // window — Electron creates one of those for window.open() by default.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Cheap production diagnostic — if the packaged app ever fails to load
  // (bad electron-serve path, etc.) this shows up in the main process log
  // instead of a silent blank window.
  win.webContents.on('did-fail-load', (_e, code, desc) => console.error('[electron] load failed:', code, desc))

  if (VITE_DEV_SERVER_URL) {
    // Dev keeps a menu (reload, DevTools, copy/paste) — but Electron's default
    // menu binds Toggle DevTools to F12 on Windows/Linux, and that accelerator
    // is consumed by the main process before the renderer's keydown fires. F12
    // is the in-app "Place as Unpaid" shortcut (see POS.jsx), so rebind DevTools
    // to Ctrl+Shift+I here to free F12 for the renderer. (`before-input-event`
    // can't do this surgically — its preventDefault also swallows the page
    // keydown, which would break the shortcut too.) Production ships no menu at
    // all (below), so F12 there never touches DevTools regardless.
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: 'Edit',
          submenu: [
            { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
            { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
          ],
        },
        {
          label: 'View',
          submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools', accelerator: 'CmdOrCtrl+Shift+I' },
            { type: 'separator' },
            { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
          ],
        },
        { role: 'windowMenu' },
      ]),
    )
    await win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    Menu.setApplicationMenu(null)
    await loadProdApp(win)
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
