# Phase 3 — Local Deployment Hardening

**Status: ✅ built and verified as far as this dev sandbox allows.** See `deployment-setup.md` for the one-time on-site setup steps and "Verification notes" below for exactly what was and wasn't testable from a Linux/WSL dev container rather than the actual target Windows restaurant PC.

**Alternative on-site deployment now also exists**: `control-panel/` is a single Electron app that embeds this same backend directly (no PM2, no manual `.env`/service setup — see `control-panel/README.md`), for whoever wants the simplest possible install at the cost of PM2's independent crash-supervision. The PM2 path documented below is unchanged and still the more resilient option; neither replaces the other, they're two supported ways to run the same local server. The Control Panel also adds an admin surface this plain PM2 path doesn't have: a password-gated window showing live connected devices (name/role/IP/connected-since) with a real disconnect button — see `control-panel/README.md`'s "Operations available in the panel". That disconnect is backed by a new session registry (`src/auth/sessions.ts` — see `02-phase-1-single-device-backend.md`'s auth section), not something control-panel-specific, so the same "restart requires re-login" consequence applies to this PM2 deployment too.

Makes the local server survive real-world restaurant conditions without a technical person on-site babysitting it. No new features for staff — this phase is about the server being trustworthy, not about doing more.

## Goal

The "dedicated PC" from `requirements.md` §12 behaves like a real server: always on, restarts itself if it crashes, and its data is backed up daily without anyone remembering to do it manually.

## Scope

- Package the local Fastify server as a standalone background service (PM2 or `node-windows`) — auto-starts on boot, auto-restarts on crash. Matches §12's framing of a dedicated PC that *is* the server, independent of whether any Electron client window happens to be open on it.
- Device pairing/discovery on the LAN, so a new POS terminal or KDS screen can find the server PC without a staff member typing an IP address by hand (relevant to §13's on-site install process, which assumes non-technical setup).
- Local backup job: the SQLite database file copied to an external drive/USB on a schedule, satisfying §12's "automatic daily backups" requirement — this is separate from and simpler than the VPS sync built in Phase 4 (a local safety net, not the central store).
- Basic operational visibility: is the local server up, when did it last back up, when did it last successfully sync to the VPS (once Phase 4 exists) — doesn't need to be fancy, just answerable without SSH-ing into the machine.

## Frontend alignment

Minimal — mostly a settings/admin-panel surface to show server health (last backup time, sync status) rather than a change to existing pages. Could reasonably live in `Settings.jsx`, which is already the Admin-only configuration page.

## Done when

- The server PC can be rebooted and the backend comes back up on its own, with all connected devices reconnecting automatically (leaning on Phase 2's Socket.IO reconnect behavior).
- A backup file from the previous day exists on the external drive without anyone having triggered it manually.
- A new device can join the LAN and start talking to the server without manual IP configuration.

## What was built

- **Process supervision**: `backend/ecosystem.config.cjs` (PM2). `npm run service:start/stop/restart/logs/status`. PM2 chosen over `node-windows` specifically — it's cross-platform (Windows via `pm2-windows-startup`, see `deployment-setup.md`), so the exact same config and restart-on-crash behavior is verifiable in a Linux dev sandbox and still correct for the real Windows target.
- **LAN discovery**: `backend/src/realtime/discovery.ts` — a UDP responder on port 41234 answering a broadcast `CAFE_ALI_DISCOVER` request with `{name, port}`. The client side lives in Electron's main process (`frontend/electron/main.js`'s `discover-server` IPC handler, using Node's `dgram` — a renderer/browser can't open raw UDP sockets), exposed to the renderer via `preload.js`'s `window.electron.discoverServer()`. `src/api/client.js`'s `discoverAndSetBase()` calls it once at startup (`main.jsx`, before the first render) and overrides the default `localhost:4000` base URL if a server answers — a no-op if `VITE_API_URL` is explicitly set, or if not running inside Electron.
- **Local backup**: `backend/src/backup/` — `runBackup()` copies the live SQLite file to `env.backupDir` (env `BACKUP_DIR`, standing in for the external-drive mount path) as `dev-YYYY-MM-DD.db`; `startBackupSchedule()` checks every 15 minutes whether today's file exists yet and the configured hour (`env.backupHour`, default 3am) has passed, so a server that was off at 3am and comes back at 9am still backs up that same morning instead of waiting for the next day.
- **Operational visibility**: `GET /api/system/health` (Admin-only, same gate as `/api/settings`) returns `{uptimeSeconds, lastBackupAt}`; surfaced in `Settings.jsx`'s new "Server Health" card, polling every 60s with a manual refresh button.

## Verification notes

This dev environment is Linux/WSL, not the actual restaurant Windows PC, so verification split into two tiers:

**Fully verified, real end-to-end:**
- PM2 auto-restart: killed the live process (`kill -9`), confirmed PM2 spawned a new PID and the server (including Socket.IO) was serving again within seconds.
- Backup job: ran it live, confirmed a valid SQLite file (`file` command identified it correctly) landed at the configured path, and `/api/system/health` reported the correct timestamp.
- LAN discovery: sent a real UDP broadcast and got the correct reply from the backend responder. Then launched the **actual Electron app** (via `xvfb-run`, not just the browser dev server — the IPC/contextBridge wiring only exists there) and called `window.electron.discoverServer()` for real: it returned the machine's actual LAN-facing IP (`192.168.100.152:4000`), not just localhost — as close to a real second-device scenario as one machine allows.
- Settings health panel: confirmed it renders correct live data for Admin and is fully inaccessible (nav item doesn't even appear) for Manager.

**Not verifiable here, needs the real hardware:**
- Surviving an actual OS reboot (`pm2 startup`/`pm2 save` is documented in `deployment-setup.md` but deliberately not run in this shared dev sandbox, since it registers a boot-time service on whatever machine runs it).
- Discovery being found by a genuinely separate physical device on a real LAN (only one machine was available here).
- Writing to a real external/USB drive (verified against a local directory standing in for that mount path — the copy mechanism itself doesn't care what filesystem `BACKUP_DIR` points at).
