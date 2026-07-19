// Login: verify credentials against the Staff table and return the JWT payload
// the route will sign. Replaces the frontend's demo `login({ role, name })`
// (Login.jsx set state with no verification) with a real username/password
// check. Usernames are stored + compared lower-cased.

import { prisma } from '../db/client.js'
import { verifyPassword } from '../auth/password.js'
import { ServiceError } from '../lib/errors.js'
import type { JwtPayload } from '../auth/guard.js'
import type { Role } from '../core/permissions.js'

const VALID_ROLES: Role[] = ['Admin', 'Manager', 'Cashier', 'Kitchen']

export async function authenticateCredentials(username: unknown, password: unknown): Promise<Omit<JwtPayload, 'jti'>> {
  const uname = String(username ?? '').trim().toLowerCase()
  const pass = String(password ?? '')
  if (!uname || !pass) throw new ServiceError('Username and password are required.', 400)

  const staff = await prisma.staff.findUnique({ where: { username: uname } })
  // One generic message for every failure mode (unknown user, wrong password,
  // deactivated account) so a caller can't probe which usernames exist.
  const invalid = new ServiceError('Invalid username or password.', 401)
  if (!staff || !staff.active || !staff.passwordHash || !staff.systemRole) throw invalid
  if (!(await verifyPassword(pass, staff.passwordHash))) throw invalid
  if (!VALID_ROLES.includes(staff.systemRole as Role)) {
    throw new ServiceError('This account has no system role assigned.', 403)
  }

  return { sub: staff.id, name: staff.name, role: staff.systemRole as Role }
}
