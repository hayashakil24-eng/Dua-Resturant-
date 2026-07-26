// In-memory registry of active login sessions, keyed by each JWT's `jti`.
// Existed nowhere before this: JWTs were purely stateless (valid forever on
// signature alone), which meant there was no way to actually force a device
// off — a Socket.IO disconnect would just auto-reconnect with the same still-
// valid token a second later. The Control Panel's "disconnect device" feature
// needs a disconnect that sticks, so login now registers a session here, both
// `authenticate()` (REST) and the Socket.IO auth middleware check it on every
// request/connection, and revoking it forces a real re-login.
//
// Deliberately in-memory, not persisted: a server restart requiring everyone
// to log in again is the correct, expected behavior for a session store (and
// this app has no session store at all today), not a regression — restarting
// the process has never preserved anything except the database.

import type { Role } from '../core/permissions.js'

export interface SessionInfo {
  jti: string
  staffId: string
  name: string
  role: Role
  ip: string
}

const sessions = new Map<string, SessionInfo>()

export function registerSession(info: SessionInfo): void {
  sessions.set(info.jti, info)
}

export function isSessionValid(jti: string | undefined): boolean {
  return !!jti && sessions.has(jti)
}

export function revokeSession(jti: string): void {
  sessions.delete(jti)
}

// Every device logged in as one staff member. Used when a password changes:
// the old password's sessions must stop working, or a reset (or an admin
// locking out a departed employee) would only take effect at the next
// voluntary logout. `exceptJti` keeps the caller's own session alive so
// changing your own password doesn't sign you out of the screen you're on.
export function revokeSessionsForStaff(staffId: string, exceptJti?: string): number {
  let revoked = 0
  for (const [jti, info] of sessions) {
    if (info.staffId === staffId && jti !== exceptJti) {
      sessions.delete(jti)
      revoked++
    }
  }
  return revoked
}
