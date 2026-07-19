// Bootstraps exactly one Admin login for a brand-new database that has no
// Staff rows yet. Needed specifically by the Control Panel deployment path:
// its first-time setup runs `prisma migrate deploy` (schema only), unlike
// local dev's `prisma migrate dev` which auto-runs prisma/seed.ts. Without
// this, a freshly set-up Control Panel has a running, reachable server that
// nobody can actually log into — the schema exists but no one can pass
// authenticateCredentials(). A no-op if any Staff already exists (e.g.
// re-running setup, or a database that came from the dev seed instead), so
// it's safe to call unconditionally.

import { prisma } from '../db/client.js'
import { hashPassword } from './password.js'

export async function ensureAdminAccount(username: string, password: string, name: string): Promise<void> {
  const existing = await prisma.staff.count()
  if (existing > 0) return
  await prisma.staff.create({
    data: {
      name,
      role: 'Admin',
      username: username.trim().toLowerCase(),
      passwordHash: await hashPassword(password),
      systemRole: 'Admin',
    },
  })
}
