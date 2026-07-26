// Login: verify credentials against the Staff table and return the JWT payload
// the route will sign. Replaces the frontend's demo `login({ role, name })`
// (Login.jsx set state with no verification) with a real username/password
// check. Usernames are stored + compared lower-cased.

import { prisma } from '../db/client.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { revokeSessionsForStaff } from '../auth/sessions.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'
import type { JwtPayload } from '../auth/guard.js'
import type { Role } from '../core/permissions.js'

export const VALID_ROLES: Role[] = ['Admin', 'Manager', 'Cashier', 'Kitchen']

// Same floor signup enforces (staff.service.ts) — one rule for every way a
// password can be set.
const MIN_PASSWORD = 6

export async function authenticateCredentials(username: unknown, password: unknown): Promise<Omit<JwtPayload, 'jti'>> {
  const uname = String(username ?? '').trim().toLowerCase()
  const pass = String(password ?? '')
  if (!uname || !pass) throw new ServiceError('Username and password are required.', 400)

  const staff = await prisma.staff.findUnique({ where: { username: uname } })
  // One generic message for every failure mode (unknown user, wrong password,
  // deactivated account, no credentials at all) so a caller can't probe which
  // usernames exist. Deliberately checked — and the password verified —
  // before ever looking at `status` below, so a wrong-password attempt on a
  // pending/rejected account can't be distinguished from one against an
  // unknown username; only the account's own correct password reveals its
  // own status.
  const invalid = new ServiceError('Invalid username or password.', 401)
  if (!staff || !staff.active || !staff.passwordHash) throw invalid
  if (!(await verifyPassword(pass, staff.passwordHash))) throw invalid

  if (staff.status === 'rejected') {
    throw new ServiceError('Your signup request was not approved.', 403)
  }
  if (staff.status === 'pending') {
    // No systemRole yet — Admin hasn't assigned one. Let them in with the
    // Pending role so the frontend can show a waiting screen; PERMISSIONS.Pending
    // (core/permissions.ts) locks out every page, and guard.ts's authenticate()
    // separately rejects this role outright on routes with no per-page check.
    return { sub: staff.id, name: staff.name, role: 'Pending' }
  }

  // status === 'approved' (the default for every existing/admin-created row) —
  // unchanged from before self-signup existed.
  if (!staff.systemRole || !VALID_ROLES.includes(staff.systemRole as Role)) {
    throw new ServiceError('This account has no system role assigned.', 403)
  }
  return { sub: staff.id, name: staff.name, role: staff.systemRole as Role }
}

// ---- Password changes -----------------------------------------------------

// Accounts that can actually log in — the picker on Settings lists these, so
// an Admin can't try to "reset the password" of a staff record that has no
// credentials at all (most rows: staff.service.ts creates them without a login).
export async function listLoginAccounts() {
  const rows = await prisma.staff.findMany({
    where: { username: { not: null }, status: 'approved' },
    select: { id: true, name: true, username: true, systemRole: true, active: true },
    orderBy: { name: 'asc' },
  })
  return rows
}

async function writePassword(staffId: string, password: string, actor: Actor, action: string, details: Record<string, unknown>) {
  const passwordHash = await hashPassword(password)
  return prisma.$transaction(async (tx) => {
    const updated = await tx.staff.update({ where: { id: staffId }, data: { passwordHash } })
    await writeAudit(tx, { action, actor, details })
    return updated
  })
}

// Self-service change: the current password is required, so a walk-up on an
// unattended screen can't lock the real owner out of their own account.
export async function changeOwnPassword(actor: Actor, jti: string, currentPassword: unknown, newPassword: unknown) {
  const current = String(currentPassword ?? '')
  const next = String(newPassword ?? '')
  if (!current || !next) throw new ServiceError('Current and new password are required.', 400)
  if (next.length < MIN_PASSWORD) throw new ServiceError(`Password must be at least ${MIN_PASSWORD} characters.`, 400)

  const staff = await prisma.staff.findUnique({ where: { id: actor.id } })
  if (!staff || !staff.passwordHash) throw new ServiceError('This account has no password set.', 400)
  if (!(await verifyPassword(current, staff.passwordHash))) throw new ServiceError('Current password is incorrect.', 400)

  await writePassword(staff.id, next, actor, 'PASSWORD_CHANGED', { staffId: staff.id, self: true })
  // Other devices logged in as this person keep working on the old password
  // until their session is dropped; this one stays alive.
  const revoked = revokeSessionsForStaff(staff.id, jti)
  return { ok: true, otherDevicesSignedOut: revoked }
}

// Admin resetting somebody else's password — no current password needed (the
// point is that the Admin doesn't know it), so this route is Admin-gated and
// always audited with who changed whose.
export async function setStaffPassword(actor: Actor, staffId: string, newPassword: unknown) {
  const next = String(newPassword ?? '')
  if (!next) throw new ServiceError('A new password is required.', 400)
  if (next.length < MIN_PASSWORD) throw new ServiceError(`Password must be at least ${MIN_PASSWORD} characters.`, 400)

  const staff = await prisma.staff.findUnique({ where: { id: staffId } })
  if (!staff) throw new ServiceError('Employee not found.', 404)
  if (!staff.username) throw new ServiceError('This employee has no login account.', 400)

  await writePassword(staff.id, next, actor, 'STAFF_PASSWORD_CHANGED', {
    staffId: staff.id,
    staffName: staff.name,
    username: staff.username,
  })
  // Every device of the changed account must re-login — an Admin resetting a
  // password is often exactly how a lost or unwanted session gets cut off.
  const revoked = revokeSessionsForStaff(staff.id)
  return { ok: true, devicesSignedOut: revoked }
}
