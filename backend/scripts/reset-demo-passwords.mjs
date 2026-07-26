// One-off dev helper: put the four demo logins (admin/manager/cashier/kitchen)
// back on password "1234" after manual password-change testing. Dev database
// only — never point this at the Control Panel's cafe-ali.db.

import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'node:crypto'

const salt = randomBytes(16)
const hash = scryptSync('1234', salt, 64)
const stored = `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`

const prisma = new PrismaClient()
const r = await prisma.staff.updateMany({
  where: { username: { in: ['admin', 'manager', 'cashier', 'kitchen'] } },
  data: { passwordHash: stored },
})
console.log('demo logins reset to 1234:', r.count)
await prisma.$disconnect()
