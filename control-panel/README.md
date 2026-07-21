# Cafe Ali Control Panel

A single Electron app that **is** the local server — no separate Node.js
install, no `npm install`/`npm run build`, no terminal, no `.env` editing.
This is an alternative to the PM2-based deployment described in
`../docs/04-phase-3-deployment-hardening.md`, for whoever wants the
simplest possible on-site setup; that PM2 path still exists (`backend/`'s own
`service:*` scripts) for anyone who prefers running the backend as a plain
background service instead. Neither replaces the other — they're two
supported ways to run the same local server.

**The trade-off, on purpose**: PM2 supervises the backend at the OS level —
if it crashes, PM2 notices and restarts it within seconds, independent of
anything else. Here, the backend runs *inside* this app's process, so an
unhandled crash takes the control panel down too; recovery relies on Windows
relaunching this app (registered via `app.setLoginItemSettings`), not an
external watchdog. Mitigated by the backend's own error handling (Fastify's
error handler already turns request failures into a plain 500, not a process
crash) but it's a real difference, not just cosmetic — see the main.js file
header.

## How it works

- `electron/main.js` imports `@cafe-ali/backend` (a `file:../backend`
  dependency — the exact same code as the standalone deployment, Phases 2-4
  included: Socket.IO, LAN discovery, scheduled backups, VPS sync) and starts
  it directly in the Electron main process instead of spawning
  `node dist/src/server.js` as a separate process.
- All writable state (the SQLite file, backup destination, generated JWT
  secret, panel password hash) lives under Electron's per-user `userData`
  directory — never in the install location itself, which is often read-only
  (Program Files).
- First launch: a setup wizard generates a random JWT secret, runs the
  Prisma migration via the bundled CLI, asks (via a native folder-picker, not
  a text field) where backups should go, and asks for a **panel password**.
  Since `prisma migrate deploy` (unlike local dev's `migrate dev`) doesn't
  auto-seed any data, setup also bootstraps one Admin login for the actual
  restaurant app — username `admin`, same password just entered — via
  `ensureAdminAccount()` (`backend/src/auth/bootstrap.ts`), so there's
  something to sign into on first run. Every launch after that shows a lock
  screen requiring the panel password, then goes straight to the dashboard.
- The window hides rather than closes (tray icon instead) — this app is
  meant to run in the background all day, the same as the PM2 service it can
  replace.

## Operations available in the panel

This is what "control panel" actually means here — not a view into orders/
sales (that's the regular Cafe Ali app), but control over the server itself:

- **Panel password** — gates the whole window, separate from staff logins.
  Set once during setup; required again every time the app is launched (the
  window hiding to tray does *not* re-lock it — unlock lasts for that run of
  the app, not per-show). Checked both in the renderer (lock screen) and
  again in the main process on every sensitive IPC call, so the renderer gate
  isn't the only thing standing between a locked panel and the server.
- **Server status** + **Start/Stop** toggle — unchanged from before.
- **Connected devices** — every currently-open, authenticated Socket.IO
  connection from a staff device on the LAN (`backend/src/realtime/socket.ts`'s
  `listConnections()`): name, role, IP, connected-since time. Polls every 5s.
- **Disconnect a device** — not just a socket kick (which would silently
  reconnect within ~1s, since the frontend auto-reconnects with the same
  still-valid token). This revokes that login's session server-side
  (`backend/src/auth/sessions.ts`) *and* closes the live socket, so the
  device actually has to log in again — verified directly (see below).

Session revocation is new backend infrastructure, not just a control-panel
UI feature: JWTs previously had no server-side state at all (valid forever on
signature alone). Login now registers a session keyed by a `jti`; both REST
(`authenticate()` in `auth/guard.ts`) and the Socket.IO handshake check it.
One consequence worth knowing: restarting the backend now requires everyone
to log in again (sessions are in-memory, not persisted) — a behavior change
from the previous fully-stateless JWTs, and the correct trade-off for
"disconnect" to mean anything.

## Dev

```bash
cd control-panel
npm install
npm start
```

## Packaging (not fully verified — see caveats)

```bash
npm run dist   # electron-builder -> release/
```

**Known packaging risk, not verified against a real built Windows installer
in this dev sandbox** (no Windows machine, no ability to run a packaged
`.exe` here): Prisma's migration-engine binary and native Node addons can't
execute from inside an `.asar` archive. `package.json`'s `build.asarUnpack`
already lists `@cafe-ali/backend`, `@prisma/**`, and `.prisma/**` for this
reason, and `main.js`'s `runMigrations()` resolves the CLI path differently
for `app.isPackaged` — but this logic has only been exercised in **dev
mode** (unpackaged, `npm start`), where none of this applies since nothing is
inside an asar archive yet. Whoever first builds and installs a real
packaged version should treat the setup wizard as the first thing to test,
specifically watching for a migration failure — that's exactly where an
asar/native-binary packaging mistake would surface.

## What was verified (dev mode, real UI clicks — not just direct API calls)

- Setup wizard: clicked "Choose…" → real folder-picker IPC round-trip →
  filled + confirmed a panel password → clicked "Complete Setup" → real
  Prisma migration ran → bootstrapped admin login created → real JWT secret
  generated and saved → embedded server actually started → dashboard shown
  (setup auto-unlocks for whoever just ran it).
- **External reachability**: a plain `fetch()` from a completely separate
  process (standing in for another device on the LAN) successfully reached
  the embedded server's `/api/health` — confirms this isn't just working
  "internally" within the Electron app.
- **Manual start/stop**: clicked "Stop Server" in the real UI → external
  health check immediately started failing (connection refused). Clicked
  "Start Server" again → health check succeeded again. This is the exact
  "admin clicks once, status changes everywhere" behavior that motivated
  building this app in the first place.
- **Connected devices + disconnect, end to end**: logged in via the
  bootstrapped admin account and opened a real Socket.IO connection (standing
  in for a staff device), same as the frontend does — the panel's device
  list picked it up on its next poll, showing the real name/role/IP/time.
  Clicked the real "Disconnect" button: the socket actually dropped
  (server-initiated, confirmed via the socket's own `disconnect` event, not
  just the UI's optimism), the device count went back to 0, and a subsequent
  request with the *same still-in-hand token* got a real `401` ("This session
  has been disconnected") — proving this is a genuine forced logout, not a
  cosmetic kick that reconnects a second later.
- **Lock screen, end to end**: killed and relaunched the app pointed at the
  same user-data directory — got the lock screen (not the setup wizard,
  confirming setup state persists). A wrong password was rejected and stayed
  locked; the correct password unlocked straight to the dashboard.
- A real backup file was produced by the embedded `startBackupSchedule()`
  during this flow and validated as a genuine SQLite file.
- Window-close-to-tray behavior confirmed indirectly: Electron's normal
  "close the window" signal does *not* terminate the app (by design) — a
  test harness has to kill the process directly, exactly as a user's normal
  window-close click should not stop the server.

**Not verified**: the actual native OS folder-picker dialog itself (headless
testing can't drive a real system dialog — a temporary env-var test bypass
was used during development and removed afterward), and anything specific to
a packaged build (see "Packaging" above) or a real Windows machine.
