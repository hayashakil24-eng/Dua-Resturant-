import { app, BrowserWindow, Menu, shell, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { exec } from 'node:child_process'
import dgram from 'node:dgram'
import serve from 'electron-serve'
import log from 'electron-log/main'
// electron-updater is CommonJS, and `autoUpdater` is a lazy getter on its
// exports object (instantiates the platform updater on first access) — that
// pattern isn't reliably picked up by Node's CJS->ESM named-export interop,
// which crashed on real Windows with "Named export 'autoUpdater' not found"
// even though the property genuinely exists. Default-import + destructure
// avoids relying on that static analysis entirely.
import electronUpdaterPkg from 'electron-updater'
const { autoUpdater } = electronUpdaterPkg
import { sendRawToPrinter } from './rawPrint.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Update checks were failing silently on some restaurant PCs (console.error
// in a GUI app launched from a shortcut goes nowhere — there's no attached
// console to read it from) with no way to tell "no update" from "check
// errored" from "install blocked by UAC/Smart App Control". This file-backed
// logger is what makes those machines diagnosable after the fact — a staff
// member can email/USB-copy app.log instead of us needing remote access.
// app.getPath('userData') (not a hardcoded %APPDATA% string) so this respects
// whatever permissions the actual logged-in Windows account has, admin or not.
const logsDir = path.join(app.getPath('userData'), 'logs')
try {
  fs.mkdirSync(logsDir, { recursive: true })
} catch (err) {
  console.error('[electron-log] could not create logs dir:', err)
}
log.transports.file.resolvePathFn = () => path.join(logsDir, 'app.log')
log.transports.file.level = 'debug'
log.transports.console.level = 'debug'
log.transports.file.maxSize = 5 * 1024 * 1024 // 5MB, then archiveLogFn below rotates it
// electron-log's built-in rotation keeps only one backup (app.old.log) —
// bump that to 3 (app.log.1 oldest-first-out .. app.log.3 most recent) since
// a single backup can roll over before anyone's looked at a slow-building
// issue like a UAC prompt nobody's dismissing.
log.transports.file.archiveLogFn = (file) => {
  try {
    const filePath = file.toString()
    const dir = path.dirname(filePath)
    const base = path.basename(filePath)
    const rotated3 = path.join(dir, `${base}.3`)
    const rotated2 = path.join(dir, `${base}.2`)
    const rotated1 = path.join(dir, `${base}.1`)
    if (fs.existsSync(rotated3)) fs.unlinkSync(rotated3)
    if (fs.existsSync(rotated2)) fs.renameSync(rotated2, rotated3)
    if (fs.existsSync(rotated1)) fs.renameSync(rotated1, rotated2)
    if (fs.existsSync(filePath)) fs.renameSync(filePath, rotated1)
  } catch (err) {
    console.error('[electron-log] log rotation failed:', err)
  }
}
log.errorHandler.startCatching()

// `net session` only succeeds for an elevated/admin account — this is the
// cheapest reliable signal for whether the silent update install is likely
// to hit a UAC prompt the logged-in till account can't dismiss (see the
// auto-update investigation: standard-user tills are the leading suspect for
// "update never applies" on some restaurant PCs but not others).
function checkAdminStatus() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve('n/a (non-Windows)')
    exec('net session', (error) => resolve(error ? 'standard user' : 'admin'))
  })
}

async function logSystemContext() {
  const adminStatus = await checkAdminStatus()
  log.info('APP STARTED', {
    timestamp: new Date().toISOString(),
    appVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    platform: process.platform,
    osRelease: os.release(),
    adminStatus,
    installDirectory: path.dirname(process.execPath),
    logFile: log.transports.file.getFile().path,
  })
}

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
  win.webContents.on('did-fail-load', (_e, code, desc) => log.error('renderer load failed', { code, description: desc }))

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
    return printers.map((p) => ({ name: p.name, displayName: p.displayName, description: p.description, isDefault: Boolean(p.isDefault) }))
  } catch {
    return []
  }
})

// Guards against two print calls overlapping on the same webContents (e.g. a
// stuck renderer retry landing mid-job) — belt-and-suspenders alongside
// print.js's own renderer-side debounce, which already covers the common
// rapid-double-click case per print surface.
let printing = false
// One webContents.print() call, wrapped as a promise — shared by the primary
// thermal-optimized attempt and the fallback below.
function printAttempt(options) {
  return new Promise((resolve) => {
    mainWindow.webContents.print(options, (success, failureReason) => resolve({ success, error: success ? null : failureReason }))
  })
}
ipcMain.handle('print-silent', async (_e, { deviceName } = {}) => {
  if (!mainWindow) return { success: false, error: 'No window available.' }
  if (printing) return { success: false, error: 'A print job is already in progress.' }
  printing = true
  try {
    const base = {
      silent: true,
      printBackground: true,
      // deviceName omitted (not just empty-string) when unset — Electron's
      // own documented fallback is the system default printer in that
      // case, never "Microsoft Print to PDF" or any other guess.
      ...(deviceName ? { deviceName } : {}),
    }
    const first = await printAttempt({
      ...base,
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
    })
    if (first.success) return first
    log.error('print-silent: attempt 1 (printableArea) failed', { deviceName: deviceName || '(system default)', error: first.error })

    // usePrinterDefaultPageSize + printableArea margins together fail
    // outright ("Invalid printer settings") on printers that don't expose
    // real page-size/printable-area media the way a physical thermal driver
    // does — virtual printers like "Microsoft Print to PDF" (the Windows
    // default on a dev machine with no real printer attached), XPS Document
    // Writer, etc. The client's actual thermal printer always succeeds on
    // the first attempt above; this is a compatibility fallback for
    // everything else, so printing degrades to plain default margins
    // instead of hard-failing.
    const second = await printAttempt({ ...base, margins: { marginType: 'default' } })
    if (second.success) return second
    log.error('print-silent: attempt 2 (default margins) failed', { deviceName: deviceName || '(system default)', error: second.error })

    // Some real thermal drivers (seen in the field on a Black Copper
    // BC-98AC) reject BOTH attempts above outright, because they can't
    // answer Chromium's page-size/margin queries at all — yet the same
    // driver prints fine through the old non-silent window.print() dialog,
    // where Chromium never queries any of that and just hands the job to
    // Windows with the driver's own already-configured defaults. This last
    // attempt reproduces that: no margins/pageSize field of any kind, so
    // nothing here is asked of the driver.
    const third = await printAttempt(base)
    if (!third.success) log.error('print-silent: attempt 3 (bare minimum) failed', { deviceName: deviceName || '(system default)', error: third.error })
    return third
  } finally {
    printing = false
  }
})

// Raw ESC/POS printing (see rawPrint.js's header comment for why this exists
// alongside print-silent above) — takes pre-built printer command bytes from
// the renderer (src/utils/escpos.js) and hands them to the Windows spooler
// as a RAW job, never through webContents.print()/Chromium at all. `bytes`
// arrives as a Uint8Array — Electron's IPC structured-clones typed arrays,
// so no base64/array-of-numbers encoding is needed on either side.
ipcMain.handle('print-raw', async (_e, { deviceName, bytes } = {}) => {
  try {
    const result = await sendRawToPrinter(deviceName, Buffer.from(bytes))
    if (!result.success) log.error('print-raw failed', { deviceName: deviceName || '(none)', error: result.error })
    return result
  } catch (err) {
    log.error('print-raw threw', { deviceName: deviceName || '(none)', error: err.message })
    return { success: false, error: err.message }
  }
})

// LAN server discovery (docs/04-phase-3-deployment-hardening.md) — a
// new POS/KDS device finds the server PC's IP without a staff member typing
// it in. UDP broadcast/reply is a `dgram` (Node) API, unavailable to the
// renderer's browser sandbox, hence this lives in the main process and is
// exposed to the renderer via preload.js/contextBridge like any other
// privileged capability (never by flipping nodeIntegration on).
const DISCOVERY_PORT = 41234
// The renderer blocks its first paint on this call (main.jsx's
// `discoverAndSetBase().finally(render)`) — on the common single-PC setup
// (no other server to discover), every launch pays this full timeout as a
// blank window. A real reply arrives in single-digit milliseconds on any
// working LAN/loopback, so 500ms is still generous headroom for a slow
// network while cutting the guaranteed worst-case wait from 1.5s to 0.5s.
const DISCOVERY_TIMEOUT_MS = 500

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
// Routes electron-updater's own internal logging (HTTP requests, feed
// parsing, NSIS spawn) into the same file — this is what previously only
// existed as opaque behavior with nothing written anywhere.
autoUpdater.logger = log

autoUpdater.on('checking-for-update', () => {
  log.info('update: checking-for-update', { feedURL: autoUpdater.getFeedURL?.() })
  mainWindow?.webContents.send('update-checking')
})
autoUpdater.on('update-available', (info) => {
  log.info('update: update-available', { version: info.version, releaseDate: info.releaseDate, files: info.files })
  mainWindow?.webContents.send('update-available', { version: info.version })
})
autoUpdater.on('update-not-available', (info) => {
  log.info('update: update-not-available', { currentVersion: app.getVersion(), latestVersion: info?.version })
  // The auto (silent) checks never told the renderer about a no-op result —
  // deliberately, since a cashier shouldn't see anything for the ordinary
  // "nothing to update" case. The manual "Check Now" button in Settings
  // needs this event to give feedback, so it's sent unconditionally; nothing
  // currently listens for it except that button.
  mainWindow?.webContents.send('update-not-available', { currentVersion: app.getVersion() })
})
autoUpdater.on('download-progress', (progress) => {
  log.debug('update: download-progress', { percent: Math.round(progress.percent), bytesPerSecond: progress.bytesPerSecond, transferred: progress.transferred, total: progress.total })
  mainWindow?.webContents.send('update-download-progress', { percent: Math.round(progress.percent) })
})
autoUpdater.on('update-downloaded', (info) => {
  log.info('update: update-downloaded', { version: info.version })
  mainWindow?.webContents.send('update-downloaded', { version: info.version })
})
autoUpdater.on('before-quit-for-update', () => {
  log.info('update: before-quit-for-update')
})
// CRITICAL — this is the event that was previously going to a console
// nobody could see (see the file-header comment). Every field electron-updater
// puts on its Error objects, logged as structured data rather than just
// err.message, since which of message/code/errno is populated is itself part
// of diagnosing UAC vs. Smart App Control vs. network vs. manifest-race
// failures.
autoUpdater.on('error', (err) => {
  log.error('update: error', {
    message: err?.message,
    stack: err?.stack,
    code: err?.code,
    errno: err?.errno,
  })
  // Same reasoning as update-not-available above — the manual button needs a
  // terminal event to stop showing "Checking…" on, the silent auto-checks
  // just have nothing listening for it.
  mainWindow?.webContents.send('update-error', { message: err?.message || 'Update check failed.' })
})

ipcMain.handle('install-update', () => {
  log.info('update: restart-triggered by user')
  // isSilent, isForceRunAfter — no confirmation dialog (already confirmed in
  // the renderer's banner), and relaunch once the silent reinstall finishes.
  autoUpdater.quitAndInstall(true, true)
})

ipcMain.handle('get-app-version', () => app.getVersion())

function checkForUpdates() {
  // Dev has no packaged app-update.yml to read a feed URL from — would just
  // throw "Cannot find latest.yml" noise on every dev run.
  if (!app.isPackaged) return
  autoUpdater.checkForUpdates().catch((err) => {
    log.error('update: checkForUpdates rejected', {
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
      errno: err?.errno,
    })
  })
}

// Priority-2 fix from the auto-update investigation: previously the only way
// to see whether a check happened at all was to wait up to 4h (or a launch)
// and squint at app.log. This lets Settings' "Check for Updates Now" button
// force one on demand — same checkForUpdates() path, same logging, just not
// waiting for the timer. Distinct from checkForUpdates() only in that it
// reports an immediate failure (e.g. running unpackaged) back to the caller
// instead of swallowing it, since a button click expects a response.
ipcMain.handle('check-for-updates-now', async () => {
  if (!app.isPackaged) {
    return { ok: false, message: 'Update checks are unavailable in dev (no packaged app-update.yml).' }
  }
  try {
    await autoUpdater.checkForUpdates()
    // Outcome (found / not-available / error) arrives via the events above,
    // which the Settings panel also listens to — this is just confirming the
    // check was dispatched.
    return { ok: true }
  } catch (err) {
    log.error('update: manual checkForUpdates rejected', {
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
      errno: err?.errno,
    })
    return { ok: false, message: err?.message || 'Update check failed.' }
  }
})

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

app.whenReady().then(async () => {
  await logSystemContext()
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
