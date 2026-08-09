import { app, BrowserWindow, Menu, shell, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import dgram from 'node:dgram'
import serve from 'electron-serve'
// electron-updater is CommonJS, and `autoUpdater` is a lazy getter on its
// exports object (instantiates the platform updater on first access) — that
// pattern isn't reliably picked up by Node's CJS->ESM named-export interop,
// which crashed on real Windows with "Named export 'autoUpdater' not found"
// even though the property genuinely exists. Default-import + destructure
// avoids relying on that static analysis entirely.
import electronUpdaterPkg from 'electron-updater'
const { autoUpdater } = electronUpdaterPkg

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

let mainWindow = null

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

  mainWindow = win

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

// Silent receipt printing (src/utils/print.js's safePrint) — the renderer
// used to call window.print(), which is Chromium's own print dialog
// (Destination/Pages/Layout/Colour/Print/Cancel — the exact UI a cashier
// should never see mid-shift). Electron can't silence that dialog from the
// renderer; only the main process's webContents.print({ silent: true }) can.
// The renderer has already toggled a body.print-x class (index.css's
// @media print rules) to isolate the one #printable-x surface before either
// of these fire — same DOM/CSS window.print() used, just triggered here
// instead so no dialog ever renders. Only enumeration (read-only) + this
// print trigger are exposed to the renderer — never raw webContents access.
ipcMain.handle('list-printers', async () => {
  if (!mainWindow) return []
  try {
    const printers = await mainWindow.webContents.getPrintersAsync()
    return printers.map((p) => ({ name: p.name, displayName: p.displayName, description: p.description }))
  } catch {
    return []
  }
})

// Guards against two print calls overlapping on the same webContents (e.g. a
// stuck renderer retry landing mid-job) — belt-and-suspenders alongside
// print.js's own renderer-side debounce, which already covers the common
// rapid-double-click case per print surface.
let printing = false
ipcMain.handle('print-silent', async (_e, { deviceName } = {}) => {
  if (!mainWindow) return { success: false, error: 'No window available.' }
  if (printing) return { success: false, error: 'A print job is already in progress.' }
  printing = true
  try {
    return await new Promise((resolve) => {
      mainWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          // deviceName omitted (not just empty-string) when unset — Electron's
          // own documented fallback is the system default printer in that
          // case, never "Microsoft Print to PDF" or any other guess.
          ...(deviceName ? { deviceName } : {}),
          // Trust the target printer's OWN registered page size instead of
          // hardcoding one — a real 80mm thermal driver reports its roll size
          // here, so the receipt (which is CSS-sized at 80mm, see index.css)
          // matches what the printer actually expects with no guessed number
          // on this end. Cannot be combined with an explicit pageSize.
          usePrinterDefaultPageSize: true,
          // 'printableArea' (not 'default'/'none') asks Chromium to lay out
          // against the printer's actual hardware-safe printable rectangle —
          // the fix for content clipping at the left/right edges, which a
          // flat 0-margin request can't account for on printers whose print
          // head has its own fixed unprintable strip.
          margins: { marginType: 'printableArea' },
        },
        (success, failureReason) => resolve({ success, error: success ? null : failureReason }),
      )
    })
  } finally {
    printing = false
  }
})

// LAN server discovery (docs/04-phase-3-deployment-hardening.md) — a
// new POS/KDS device finds the server PC's IP without a staff member typing
// it in. UDP broadcast/reply is a `dgram` (Node) API, unavailable to the
// renderer's browser sandbox, hence this lives in the main process and is
// exposed to the renderer via preload.js/contextBridge like any other
// privileged capability (never by flipping nodeIntegration on).
const DISCOVERY_PORT = 41234
const DISCOVERY_TIMEOUT_MS = 1500

ipcMain.handle('discover-server', () => {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4')
    const finish = (result) => {
      socket.close()
      resolve(result)
    }
    const timer = setTimeout(() => finish(null), DISCOVERY_TIMEOUT_MS)
    socket.on('message', (msg, rinfo) => {
      clearTimeout(timer)
      try {
        const { port } = JSON.parse(msg.toString())
        finish({ host: rinfo.address, port })
      } catch {
        finish(null)
      }
    })
    socket.on('error', () => finish(null))
    socket.bind(() => {
      socket.setBroadcast(true)
      socket.send('CAFE_ALI_DISCOVER', DISCOVERY_PORT, '255.255.255.255')
    })
  })
})

// Auto-update (electron-updater, generic provider pointed at the VPS —
// see frontend/package.json's build.publish and backend/src/vps/app.ts's
// static /updates/ route). Deliberately quiet by default: this restaurant's
// internet is unreliable, so a failed/offline check must never surface as an
// error to a cashier mid-shift — only a *found* update is reported to the
// renderer, via the banner in App.jsx.
//
// installDirectory is pinned to wherever this exe is actually running from
// (not electron-builder's own default per-user path) because the combined
// installer (installer/installer.nsi) installs to a fixed Program Files
// location the individual per-app installer wouldn't know about on its own —
// this makes the downloaded update's silent reinstall (`/D=<dir>`) land
// back in the same place instead of a fresh default location.
autoUpdater.installDirectory = path.dirname(process.execPath)
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('update-available', { version: info.version })
})
autoUpdater.on('download-progress', (progress) => {
  mainWindow?.webContents.send('update-download-progress', { percent: Math.round(progress.percent) })
})
autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('update-downloaded', { version: info.version })
})
autoUpdater.on('error', (err) => {
  console.error('[electron] update check failed (likely offline):', err.message)
})

ipcMain.handle('install-update', () => {
  // isSilent, isForceRunAfter — no confirmation dialog (already confirmed in
  // the renderer's banner), and relaunch once the silent reinstall finishes.
  autoUpdater.quitAndInstall(true, true)
})

function checkForUpdates() {
  // Dev has no packaged app-update.yml to read a feed URL from — would just
  // throw "Cannot find latest.yml" noise on every dev run.
  if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => {})
}

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

app.whenReady().then(async () => {
  await createWindow()
  checkForUpdates()
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
