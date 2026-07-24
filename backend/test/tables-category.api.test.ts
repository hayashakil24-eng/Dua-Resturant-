// Category-level table ops: rename relabels a whole group's tables; delete
// removes them but is blocked while any member has a running order.

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/db/client.js'
import { seed } from '../prisma/seed.js'

let app: FastifyInstance

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}
async function tokenFor(username: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: '1234' } })
  return JSON.parse(res.body).token as string
}

beforeAll(async () => {
  await seed()
  // Isolated category with three tables to rename/delete.
  await prisma.table.deleteMany({ where: { id: { in: [9001, 9002, 9003] } } })
  await prisma.table.createMany({
    data: [
      { id: 9001, number: 'Z1', category: 'Z', section: 'Indoor', seats: 4 },
      { id: 9002, number: 'Z2', category: 'Z', section: 'Indoor', seats: 4 },
      { id: 9003, number: 'Z3', category: 'Z', section: 'Indoor', seats: 4 },
    ],
  })
  app = buildApp()
  await app.ready()
})
afterAll(async () => {
  await prisma.table.deleteMany({ where: { id: { in: [9001, 9002, 9003] } } })
  await app.close()
  await prisma.$disconnect()
})

describe('table category ops', () => {
  it('rename relabels the whole group to "<name> 1..N"', async () => {
    const admin = await tokenFor('admin')
    const res = await app.inject({ method: 'POST', url: '/api/tables/category/rename', headers: auth(admin), payload: { from: 'Z', name: 'Kids Table' } })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).renamed).toBe(3)

    const rows = await prisma.table.findMany({ where: { id: { in: [9001, 9002, 9003] } }, orderBy: { id: 'asc' } })
    expect(rows.map((r) => r.category)).toEqual(['Kids Table', 'Kids Table', 'Kids Table'])
    expect(rows.map((r) => r.number)).toEqual(['Kids Table 1', 'Kids Table 2', 'Kids Table 3'])
  })

  it('delete is blocked while a member has a running order, then works once clear', async () => {
    const admin = await tokenFor('admin')
    // Running order on one of the group's tables (category is now "Kids Table").
    const order = await prisma.order.create({ data: { orderNumber: 999001, table: 9002, waiter: 'W', payment: 'Unpaid', cancelled: false } })

    const blocked = await app.inject({ method: 'POST', url: '/api/tables/category/delete', headers: auth(admin), payload: { category: 'Kids Table' } })
    expect(blocked.statusCode).toBe(400)
    expect((await prisma.table.findMany({ where: { id: { in: [9001, 9002, 9003] } } })).length).toBe(3)

    // Settle the order → delete now succeeds.
    await prisma.order.update({ where: { id: order.id }, data: { payment: 'Paid' } })
    const ok = await app.inject({ method: 'POST', url: '/api/tables/category/delete', headers: auth(admin), payload: { category: 'Kids Table' } })
    expect(ok.statusCode).toBe(200)
    expect(JSON.parse(ok.body).deleted).toBe(3)
    expect((await prisma.table.findMany({ where: { id: { in: [9001, 9002, 9003] } } })).length).toBe(0)

    await prisma.order.delete({ where: { id: order.id } })
  })
})
