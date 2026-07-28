// Cafe Ali Control Panel — the local backend, embedded directly in this
// Electron app's main process, instead of a separate `node dist/src/server.js`
// process supervised by PM2 (docs/04-phase-3-deployment-hardening.md's
// original approach). One installer, one running app: no Node.js install, no
// npm install, no terminal commands, no .env editing for whoever sets this up
// at the restaurant.
//
// Trade-off, deliberately accepted (see conversation/design notes): PM2 gave
// OS-level crash supervision independent of the app itself; folding the
// server into this process means a genuinely unhandled crash takes the
// control panel down too, relying on Windows relaunching it (via the
// login-item registration below) rather than an external watchdog catching
// it within seconds. Mitigated by the backend's own error handling (Fastify's
// setErrorHandler already turns request-level errors into a 500, not a
// process crash) — but it's a real difference from the old approach, not
// just cosmetic.

import { app, BrowserWindow, Tray, Menu, dialog, ipcMain, nativeImage } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import crypto from 'node:crypto'
// See frontend/electron/main.js's identical comment: electron-updater is
// CommonJS with `autoUpdater` as a lazy getter, which crashed on real Windows
// under a plain named import ("Named export 'autoUpdater' not found").
import electronUpdaterPkg from 'electron-updater'
const { autoUpdater } = electronUpdaterPkg

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// @cafe-ali/backend is deliberately NOT an npm dependency of this package
// (see package.json) — resolved by explicit filesystem path instead of a
// bare specifier. electron-builder's own node-modules collector walks the
// full npm dependency graph of every *declared* dependency before any
// `files` pattern filtering runs, and doing that through this file:../backend
// link reliably ran a build machine with ~7GB RAM out of heap (electron-
// builder 26.15.3 *and* 26.15.7, confirmed against both) — backend/'s own
// node_modules is large and deep (puppeteer, prisma, embedded-postgres...)
// and the collector doesn't memoize shared subtrees the way its newer pnpm
// collector explicitly does (see that collector's own source comments).
// Undeclaring the dependency removes it from the graph entirely; the actual
// files still ship via extraResources (package.json) exactly as before.
const BACKEND_DIR = app.isPackaged ? path.join(process.resourcesPath, 'app-backend') : path.join(__dirname, '../../backend')

function importBackend() {
  return import(pathToFileURL(path.join(BACKEND_DIR, 'dist/src/index.js')).href)
}

// All writable runtime state (db file, backups, config) lives under Electron's
// per-user app-data directory — the install location itself (Program Files on
// Windows) is often read-only, so nothing should ever try to write there.
const userDataDir = app.getPath('userData')
const dbPath = path.join(userDataDir, 'cafe-ali.db')
const configPath = path.join(userDataDir, 'config.json')

let win = null
let tray = null
let backend = null // { app: FastifyInstance, io, discoverySocket, backupTimer, syncTimer, whatsappTimer } once started
let serverStatus = 'stopped' // 'stopped' | 'starting' | 'online' | 'error'
let lastError = null
let updateInfo = null // { version, ready } once electron-updater finds/downloads one, else null

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch {
    return null
  }
}

function writeConfig(config) {
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

function isSetupComplete() {
  const config = readConfig()
  return Boolean(config?.jwtSecret && config?.backupDir && fs.existsSync(dbPath))
}

// Panel access is a separate concept from staff logins (Staff.passwordHash,
// checked by the embedded backend) — this password gates the Control Panel
// window itself, since it's a physically-local admin surface that can
// start/stop the server and disconnect devices. Reuses the backend's own
// scrypt hashing (auth/password.ts, exported via src/index.ts) rather than
// rolling a second implementation.
let panelUnlocked = false

async function verifyPanelPassword(password) {
  const { verifyPassword } = await importBackend()
  const config = readConfig()
  return verifyPassword(password, config?.panelPasswordHash)
}

// Runs the backend's bundled Prisma CLI against our userData db path.
//
// Packaging gotchas this works around, all only visible on a real packaged
// Windows build (not dev mode, not `--dir` alone) — see docs/04-phase-3's
// verification notes, which had flagged real-Windows packaging as
// unverified risk, and that's exactly where these turned up:
//
// 1. This package builds with `"asar": false` (package.json). Prisma's
//    generated client (.prisma/client) isn't a declared npm dependency —
//    just output on disk @prisma/client reads internally — so it's
//    invisible to any package.json-based file inclusion, asar or not, and
//    needs an explicit extraResources copy regardless (see below). But with
//    asar enabled, that copy landed in a separate app.asar.unpacked tree
//    that plain `require()`/CJS module loading redirects into correctly,
//    while Electron's ESM loader (`import()` — this whole package is
//    "type": "module") does NOT reliably apply the same asar-unpack
//    redirect, so @cafe-ali/backend's own `import { PrismaClient } from
//    '@prisma/client'` kept resolving @prisma/client from *inside* the
//    compressed archive, where .prisma/client was never present at all —
//    "does not provide an export named 'PrismaClient'" (Prisma's fallback
//    stub for "client not generated"). Disabling asar removes the
//    distinction entirely: everything is plain files on real disk, so both
//    CJS and ESM loading resolve identically.
// 2. electron-builder's automatic dependency-graph walker repeatedly failed
//    to fully capture prisma's own (large, deep) transitive dependency tree
//    when packaging this file:../backend-linked dependency — first missing
//    .prisma/client entirely, then missing 'effect' (a dependency of
//    @prisma/config, itself a dependency of prisma) once that was fixed.
//    Rather than keep patching one missing transitive package at a time,
//    package.json's `extraResources` does an unfiltered copy of the entire
//    backend/node_modules tree straight into
//    resources/backend-full-modules/node_modules — guaranteed complete,
//    since it's exactly the tree already verified working in local dev,
//    rather than trusting electron-builder to reconstruct the graph
//    piecemeal. The extra `node_modules` path segment isn't cosmetic: Node's
//    module resolution only walks up ancestor directories literally named
//    `node_modules` looking for further packages, so prisma's own
//    `require('@prisma/config')` etc. only resolves if this copy sits
//    inside a real `node_modules` folder, not just any directory holding
//    the same contents. This is only used for running the CLI here; the
//    actual running server still uses the app's own normally-packaged
//    (much smaller) @prisma/client runtime dependency, not this CLI's tree.
// 3. Invokes prisma's own JS entry point (its "bin" field, build/index.js)
//    via Electron's bundled Node runtime (ELECTRON_RUN_AS_NODE) rather than
//    spawning node_modules/.bin/prisma directly. That .bin entry is an
//    npm-generated shim — a Unix symlink when installed on Linux/WSL, a
//    .cmd/.ps1 pair when installed on Windows — and npm only generates the
//    shim matching whatever OS ran `npm install`. This package is built
//    cross-platform (Linux building a Windows target), so the Windows
//    install never gets a .cmd shim, and even a POSIX symlink doesn't
//    survive being packaged/copied onto NTFS intact. Calling the JS entry
//    directly sidesteps shim generation entirely.
// 4. @cafe-ali/backend is NOT a declared npm dependency of this package (see
//    BACKEND_DIR/importBackend above, and package.json) — resolved by an
//    explicit filesystem path instead. electron-builder's own node-modules
//    collector walks the *entire* npm dependency graph of every declared
//    dependency before any `files` pattern even runs — doing that through
//    this file:../backend link (following it into backend's own large, deep
//    node_modules: puppeteer, prisma, embedded-postgres...) reliably ran a
//    build machine with 7GB of heap out of memory, on both electron-builder
//    26.15.3 and 26.15.7 — its collector doesn't memoize shared subtrees the
//    way its newer pnpm collector explicitly does (see that collector's own
//    source comments). The actual files backend needs at runtime still ship
//    via the extraResources copy below (point 2), just under `app-backend/`
//    instead of a node_modules path electron-builder itself has to discover.
async function runMigrations(env) {
  const nodeModulesDir = app.isPackaged
    ? path.join(process.resourcesPath, 'app-backend', 'node_modules')
    : path.join(BACKEND_DIR, 'node_modules')
  const unpackedBackendDir = BACKEND_DIR

  const prismaEntry = path.join(nodeModulesDir, 'prisma/build/index.js')
  const schemaPath = path.join(unpackedBackendDir, 'prisma/schema.prisma')
  // Prisma's CLI keeps its own copy of the query engine under
  // node_modules/@prisma/engines, separate from the one @cafe-ali/backend's
  // @prisma/client already ships (.prisma/client) — that copy is only ever
  // populated for whatever OS ran `npm install` (this package's Linux build
  // machine), so a fresh Windows install is missing it there. The CLI's own
  // fix-up-on-first-run then tries to download one and cache it into
  // node_modules/@prisma/engines, which fails with EPERM: that folder is
  // inside Program Files, unwritable by a non-elevated process. Pointing it
  // straight at the engine already shipped for @prisma/client — which the
  // running server already uses successfully — skips that fetch entirely.
  const queryEngineLibrary = path.join(nodeModulesDir, '.prisma/client/query_engine-windows.dll.node')
  const migrationEnv = { ...env, ELECTRON_RUN_AS_NODE: '1' }
  if (fs.existsSync(queryEngineLibrary)) {
    migrationEnv.PRISMA_QUERY_ENGINE_LIBRARY = queryEngineLibrary
  }
  await execFileAsync(process.execPath, [prismaEntry, 'migrate', 'deploy', '--schema', schemaPath], {
    env: migrationEnv,
  })
}

async function runFirstTimeSetup(backupDir, panelPassword) {
  const jwtSecret = crypto.randomBytes(32).toString('hex')
  const env = { ...process.env, DATABASE_URL: `file:${dbPath}`, JWT_SECRET: jwtSecret }
  await runMigrations(env)
  // `migrate deploy` doesn't run prisma/seed.ts (unlike dev's `migrate dev`),
  // so without this a fresh install has no staff account anyone could log
  // into the actual restaurant app with. Bootstraps one Admin login —
  // username "admin", same password just entered for this panel — that
  // whoever set this up can use to sign in and add real staff accounts.
  process.env.DATABASE_URL = env.DATABASE_URL
  const { hashPassword, ensureAdminAccount } = await importBackend()
  await ensureAdminAccount('admin', panelPassword, 'Admin')
  writeConfig({
    jwtSecret,
    backupDir,
    panelPasswordHash: await hashPassword(panelPassword),
    setupCompletedAt: new Date().toISOString(),
  })
}

async function startBackend() {
  if (backend) return
  serverStatus = 'starting'
  broadcastStatus()
  const config = readConfig()
  process.env.DATABASE_URL = `file:${dbPath}`
  process.env.JWT_SECRET = config.jwtSecret
  process.env.BACKUP_DIR = config.backupDir

  try {
    // Apply any migrations shipped since this install's last launch —
    // `migrate deploy` only runs pending ones, so this is a no-op on an
    // already-current db. Without this, an app update that adds a Prisma
    // migration (e.g. a new Staff column) would leave an existing install's
    // db permanently on the old schema, since runMigrations() otherwise only
    // ever runs once, during first-time setup — the running server's Prisma
    // Client (built for the new schema) would then throw on every query
    // touching the missing column, surfacing as a 500 on login.
    await runMigrations(process.env)

    // Dynamic import: must happen AFTER the env vars above are set, since
    // @cafe-ali/backend's db/client.ts constructs its PrismaClient (which
    // reads DATABASE_URL) at module-load time.
    const {
      buildApp,
      attachSocket,
      startDiscoveryResponder,
      startBackupSchedule,
      startSyncSchedule,
      startWhatsappReportSchedule,
      startAttendanceDevicePolling,
      seedBaseline,
      env,
    } = await importBackend()

    // `migrate deploy` only creates empty tables (no prisma/seed.ts, unlike dev)
    // — so without this a fresh install has a working login but an empty menu
    // and no tables, and the POS can't take an order. Idempotent + non-
    // destructive (only fills empty collections), so running it on every launch
    // is a no-op once seeded, and it back-fills an already-set-up empty install
    // on its next launch too.
    await seedBaseline()

    const fastify = buildApp()
    await fastify.listen({ port: env.port, host: '0.0.0.0' })
    const io = attachSocket(fastify.server)
    const discoverySocket = startDiscoveryResponder()
    const backupTimer = startBackupSchedule()
    const syncTimer = startSyncSchedule()
    const whatsappTimer = startWhatsappReportSchedule()
    const attendanceDeviceTimer = startAttendanceDevicePolling()

    backend = { fastify, io, discoverySocket, backupTimer, syncTimer, whatsappTimer, attendanceDeviceTimer }
    serverStatus = 'online'
    lastError = null
  } catch (err) {
    serverStatus = 'error'
    lastError = err.message
    console.error('[control-panel] failed to start backend:', err)
  }
  broadcastStatus()
}

async function stopBackend() {
  if (!backend) return
  clearInterval(backend.backupTimer)
  clearInterval(backend.syncTimer)
  clearInterval(backend.whatsappTimer)
  clearInterval(backend.attendanceDeviceTimer)
  backend.discoverySocket.close()
  await backend.io.close()
  await backend.fastify.close()
  backend = null
  serverStatus = 'stopped'
  broadcastStatus()
}

function broadcastStatus() {
  if (win && !win.isDestroyed()) {
    win.webContents.send('status-changed', { status: serverStatus, error: lastError })
  }
}

// Auto-update (electron-updater, generic provider pointed at the VPS — see
// package.json's build.publish and backend/src/vps/app.ts's static /updates/
// route). Same reasoning as the main POS app's electron/main.js: a failed/
// offline check must stay silent (this panel is meant to run unattended in
// the tray all day on an unreliable connection), only a found update is
// surfaced, here via the dashboard's own update row rather than a popup —
// whoever's at the machine sees it next time they open the panel.
autoUpdater.installDirectory = path.dirname(process.execPath)
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

function broadcastUpdate() {
  if (win && !win.isDestroyed()) {
    win.webContents.send('update-changed', updateInfo)
  }
}

autoUpdater.on('update-available', (info) => {
  updateInfo = { version: info.version, ready: false }
  broadcastUpdate()
})
autoUpdater.on('update-downloaded', (info) => {
  updateInfo = { version: info.version, ready: true }
  broadcastUpdate()
})
autoUpdater.on('error', (err) => {
  console.error('[control-panel] update check failed (likely offline):', err.message)
})

function checkForUpdates() {
  if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => {})
}

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 640,
    resizable: false,
    title: 'Cafe Ali Control Panel',
    // Packaged Windows builds get their icon from build.win.icon
    // (assets/icon.ico) baked into the .exe, but that only applies to the
    // packaged binary — an unpackaged `npm start` window has no .exe to pull
    // an icon from, so without this it falls back to Electron's own default
    // icon. Same source art as the tray icon (assets/tray-icon.png).
    icon: path.join(__dirname, '../assets/tray-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.webContents.on('preload-error', (_e, preloadPath, error) => {
    fs.appendFileSync(path.join(userDataDir, 'cp-debug.log'), `preload error at ${preloadPath}: ${error?.stack || error}\n`)
  })
  win.loadFile(path.join(__dirname, '../src/index.html'))
  // Minimize to tray instead of quitting — this app is meant to run quietly
  // in the background all day, same as the PM2 service it replaces.
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })
}

function createTray() {
  // Windows tray icons render best around 16x16 (the OS scales up for
  // high-DPI itself) — the source logo is 500x500, so resize down rather
  // than handing the OS a full-size image to shrink on its own.
  const icon = nativeImage.createFromPath(path.join(__dirname, '../assets/tray-icon.png')).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Cafe Ali Control Panel')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Control Panel', click: () => win.show() },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuitting = true
          app.quit()
        },
      },
    ]),
  )
  tray.on('click', () => win.show())
}

// --- IPC: renderer <-> this file ------------------------------------------

ipcMain.handle('get-setup-status', () => ({ setupComplete: isSetupComplete() }))

ipcMain.handle('pick-backup-folder', async () => {
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('run-setup', async (_e, { backupDir, panelPassword }) => {
  try {
    if (!panelPassword || panelPassword.length < 4) {
      throw new Error('Choose a password at least 4 characters long.')
    }
    await runFirstTimeSetup(backupDir, panelPassword)
    panelUnlocked = true // whoever just ran setup is already standing at the machine
    await startBackend()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('unlock-panel', async (_e, password) => {
  const ok = await verifyPanelPassword(password)
  if (ok) panelUnlocked = true
  return { ok }
})

// Every handler below controls or reveals something about the running
// server — require the panel password to have been entered this session,
// not just a completed setup. Defense in depth alongside the renderer's own
// lock screen, since a renderer-only gate would be trivial to bypass.
function requireUnlocked(fn) {
  return async (...args) => {
    if (!panelUnlocked) return { ok: false, error: 'Panel is locked.' }
    return fn(...args)
  }
}

// Not gated by requireUnlocked — knowing "an update exists" isn't sensitive,
// and the setup/lock screens (before panelUnlocked) should be able to show
// it too rather than only after unlocking.
ipcMain.handle('get-update-status', () => updateInfo)
ipcMain.handle('install-update', requireUnlocked(() => {
  autoUpdater.quitAndInstall(true, true)
}))

ipcMain.handle('get-status', requireUnlocked(async () => {
  const config = readConfig()
  let health = null
  if (backend) {
    const { lastBackupInfo } = await importBackend()
    health = { lastBackupAt: lastBackupInfo()?.at ?? null }
  }
  return { status: serverStatus, error: lastError, backupDir: config?.backupDir, health }
}))

ipcMain.handle('start-server', requireUnlocked(() => startBackend()))
ipcMain.handle('stop-server', requireUnlocked(() => stopBackend()))

// Connected-devices list: each entry is one authenticated, currently-open
// Socket.IO connection from a staff device on the LAN (see
// backend/src/realtime/socket.ts's ConnectionInfo) — not a historical login
// log, just "who's live right now."
ipcMain.handle('get-devices', requireUnlocked(async () => {
  if (!backend) return []
  const { listConnections } = await importBackend()
  return listConnections()
}))

// Kicks one device off: revokes its session server-side (so it can't just
// silently reconnect with the same token) and closes its live socket. The
// device's frontend will start failing auth on its next action and need to
// log in again.
ipcMain.handle('disconnect-device', requireUnlocked(async (_e, socketId) => {
  if (!backend) return { ok: false }
  const { disconnectDevice } = await importBackend()
  return { ok: disconnectDevice(socketId) }
}))

// --- App lifecycle ----------------------------------------------------------

app.whenReady().then(async () => {
  // Auto-launch at login — this is what actually replaces PM2's "survives a
  // reboot" guarantee: Windows relaunches this app, which then starts the
  // backend itself, same net effect via a different mechanism.
  app.setLoginItemSettings({ openAtLogin: true })

  createWindow()
  createTray()

  if (isSetupComplete()) {
    await startBackend()
  }

  checkForUpdates()
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS)
})

app.on('window-all-closed', () => {
  // Deliberately does NOT quit — see the tray/close-to-hide behavior above.
  // This app is meant to keep running (and keep serving other devices) even
  // with its window closed.
})
