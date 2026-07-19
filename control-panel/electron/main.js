// Cafe Ali Control Panel — the local backend, embedded directly in this
// Electron app's main process, instead of a separate `node dist/src/server.js`
// process supervised by PM2 (backend/docs/04-phase-3-deployment-hardening.md's
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
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import crypto from 'node:crypto'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// All writable runtime state (db file, backups, config) lives under Electron's
// per-user app-data directory — the install location itself (Program Files on
// Windows) is often read-only, so nothing should ever try to write there.
const userDataDir = app.getPath('userData')
const dbPath = path.join(userDataDir, 'cafe-ali.db')
const configPath = path.join(userDataDir, 'config.json')

let win = null
let tray = null
let backend = null // { app: FastifyInstance, io, discoverySocket, backupTimer, syncTimer } once started
let serverStatus = 'stopped' // 'stopped' | 'starting' | 'online' | 'error'
let lastError = null

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
  const { verifyPassword } = await import('@cafe-ali/backend')
  const config = readConfig()
  return verifyPassword(password, config?.panelPasswordHash)
}

// Runs the backend's bundled Prisma CLI against our userData db path. In dev
// (unpackaged) this is straightforward — backend/node_modules/prisma is a
// plain directory. Packaged, Prisma's migration-engine binary can't execute
// from inside an .asar archive, which is exactly why package.json's
// `asarUnpack` includes @prisma/** and .prisma/** — this resolves the CLI at
// its *unpacked* path when app.isPackaged. Not verified against a real
// packaged Windows build in this sandbox (see docs/04-phase-3's verification
// notes) — dev-mode migration was verified live.
async function runMigrations(env) {
  const backendDir = path.dirname(require.resolve('@cafe-ali/backend/package.json'))
  const prismaCli = app.isPackaged
    ? path.join(backendDir.replace('app.asar', 'app.asar.unpacked'), 'node_modules/.bin/prisma')
    : path.join(backendDir, 'node_modules/.bin/prisma')
  const schemaPath = path.join(backendDir, 'prisma/schema.prisma')
  await execFileAsync(prismaCli, ['migrate', 'deploy', '--schema', schemaPath], { env })
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
  const { hashPassword, ensureAdminAccount } = await import('@cafe-ali/backend')
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
    // Dynamic import: must happen AFTER the env vars above are set, since
    // @cafe-ali/backend's db/client.ts constructs its PrismaClient (which
    // reads DATABASE_URL) at module-load time.
    const { buildApp, attachSocket, startDiscoveryResponder, startBackupSchedule, startSyncSchedule, env } =
      await import('@cafe-ali/backend')

    const fastify = buildApp()
    await fastify.listen({ port: env.port, host: '0.0.0.0' })
    const io = attachSocket(fastify.server)
    const discoverySocket = startDiscoveryResponder()
    const backupTimer = startBackupSchedule()
    const syncTimer = startSyncSchedule()

    backend = { fastify, io, discoverySocket, backupTimer, syncTimer }
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

function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 640,
    resizable: false,
    title: 'Cafe Ali Control Panel',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.webContents.on('preload-error', (_e, preloadPath, error) => {
    fs.appendFileSync('/tmp/cp-debug.log', `preload error at ${preloadPath}: ${error?.stack || error}\n`)
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
  const icon = nativeImage.createEmpty() // placeholder — replace with a real .ico/.png before packaging
  tray = new Tray(icon.isEmpty() ? nativeImage.createFromNamedImage('NSApplicationIcon') : icon)
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

ipcMain.handle('get-status', requireUnlocked(async () => {
  const config = readConfig()
  let health = null
  if (backend) {
    const { lastBackupInfo } = await import('@cafe-ali/backend')
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
  const { listConnections } = await import('@cafe-ali/backend')
  return listConnections()
}))

// Kicks one device off: revokes its session server-side (so it can't just
// silently reconnect with the same token) and closes its live socket. The
// device's frontend will start failing auth on its next action and need to
// log in again.
ipcMain.handle('disconnect-device', requireUnlocked(async (_e, socketId) => {
  if (!backend) return { ok: false }
  const { disconnectDevice } = await import('@cafe-ali/backend')
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
})

app.on('window-all-closed', () => {
  // Deliberately does NOT quit — see the tray/close-to-hide behavior above.
  // This app is meant to keep running (and keep serving other devices) even
  // with its window closed.
})
