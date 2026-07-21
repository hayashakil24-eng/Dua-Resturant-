// Public embedding surface for the local backend — used by the Control Panel
// Electron app (control-panel/) to run the exact same server in-process,
// instead of the standalone `node dist/src/server.js` + PM2 approach. This is
// deliberately the ONLY file the control panel imports from: every piece it
// needs (build the app, attach the realtime/discovery/backup/sync adapters)
// is re-exported here, so the control panel never reaches into backend's
// internals directly and the two can evolve independently.
//
// The VPS deployment (src/vps/server.ts) and the plain local deployment
// (src/server.ts, still here for anyone who prefers the PM2/terminal route)
// are unaffected by this file — it's an additional adapter, not a
// replacement, per docs/00-overview.md's "thin adapters on one core" rule.

export { buildApp } from './app.js'
export { attachSocket, listConnections, disconnectDevice, type ConnectionInfo } from './realtime/socket.js'
export { startDiscoveryResponder } from './realtime/discovery.js'
export { startBackupSchedule } from './backup/schedule.js'
export { runBackup, lastBackupInfo } from './backup/backup.js'
export { startSyncSchedule, syncOnce } from './sync/job.js'
export { startWhatsappReportSchedule } from './whatsapp/schedule.js'
export { env } from './env.js'
// Reused by the Control Panel for its own, separate "panel access password"
// (distinct from staff logins) — same scrypt hashing, no reason to duplicate it.
export { hashPassword, verifyPassword } from './auth/password.js'
// Gives a freshly-migrated (unseeded) Control Panel database exactly one
// working staff login — see bootstrap.ts's header for why this is needed.
export { ensureAdminAccount } from './auth/bootstrap.js'
