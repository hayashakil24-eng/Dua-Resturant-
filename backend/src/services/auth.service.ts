// Login: verify credentials against the Staff table and return the JWT payload
// the route will sign. Replaces the frontend's demo `login({ role, name })`
// (Login.jsx set state with no verification) with a real username/password
// check. Usernames are stored + compared lower-cased.

import { prisma } from '../db/client.js'
import { verifyPassword } from '../auth/password.js'
import { ServiceError } from '../lib/errors.js'
import type { JwtPayload } from '../auth/guard.js'
import type { Role } from '../core/permissions.js'

export const VALID_ROLES: Role[] = ['Admin', 'Manager', 'Cashier', 'Kitchen']

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
