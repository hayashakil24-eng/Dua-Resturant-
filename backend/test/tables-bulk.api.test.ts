// Bulk table creation + the hall edit form's single endpoint. The point of both
// is that an operator never types a table id: the server allocates it, and a
// whole hall costs one transaction, one audit row and one broadcast.

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
const cleanup = () => prisma.table.deleteMany({ where: { category: { in: ['ZZ', 'YY', 'Roof Deck'] } } })

beforeAll(async () => {
  await seed()
  await cleanup()
  app = buildApp()
  await app.ready()
})
afterAll(async () => {
  await cleanup()
  await app.close()
  await prisma.$disconnect()
})

describe('bulk table creation', () => {
  it('creates a whole hall with automatic ids and labels, then continues its numbering', async () => {
    const manager = await tokenFor('manager')
    const before = await prisma.table.aggregate({ _max: { id: true } })

    const res = await app.inject({ method: 'POST', url: '/api/tables/bulk', headers: auth(manager), payload: { category: 'ZZ', count: 5, seats: 6, section: 'Outdoor' } })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).created).toBe(5)

    const rows = await prisma.table.findMany({ where: { category: 'ZZ' }, orderBy: { id: 'asc' } })
    expect(rows.map((r) => r.number)).toEqual(['ZZ1', 'ZZ2', 'ZZ3', 'ZZ4', 'ZZ5'])
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3, 4].map((i) => (before._max.id ?? 0) + i).concat((before._max.id ?? 0) + 5))
    expect(rows.every((r) => r.seats === 6 && r.section === 'Outdoor')).toBe(true)

    // Second add continues at ZZ6 rather than restarting at ZZ1.
    const again = await app.inject({ method: 'POST', url: '/api/tables/bulk', headers: auth(manager), payload: { category: 'ZZ', count: 3 } })
    expect(again.statusCode).toBe(200)
    const all = await prisma.table.findMany({ where: { category: 'ZZ' }, orderBy: { id: 'asc' } })
    expect(all.map((r) => r.number)).toEqual(['ZZ1', 'ZZ2', 'ZZ3', 'ZZ4', 'ZZ5', 'ZZ6', 'ZZ7', 'ZZ8'])
    // New rows inherit the hall's existing seats/section when none are given.
    expect(all.slice(5).every((r) => r.seats === 6 && r.section === 'Outdoor')).toBe(true)
  })

  it('writes one audit row per bulk add, not one per table', async () => {
    const manager = await tokenFor('manager')
    const before = await prisma.auditLogEntry.count({ where: { action: { in: ['TABLES_BULK_ADDED', 'TABLE_ADDED'] } } })
    await app.inject({ method: 'POST', url: '/api/tables/bulk', headers: auth(manager), payload: { category: 'YY', count: 6 } })
    const after = await prisma.auditLogEntry.count({ where: { action: { in: ['TABLES_BULK_ADDED', 'TABLE_ADDED'] } } })
    expect(after - before).toBe(1)
  })

  it('rejects a cashier, and counts outside 1..100', async () => {
    const cashier = await tokenFor('cashier')
    const manager = await tokenFor('manager')
    expect((await app.inject({ method: 'POST', url: '/api/tables/bulk', headers: auth(cashier), payload: { category: 'ZZ', count: 1 } })).statusCode).toBe(403)
    expect((await app.inject({ method: 'POST', url: '/api/tables/bulk', headers: auth(manager), payload: { category: 'ZZ', count: 0 } })).statusCode).toBe(400)
    expect((await app.inject({ method: 'POST', url: '/api/tables/bulk', headers: auth(manager), payload: { category: 'ZZ', count: 101 } })).statusCode).toBe(400)
    expect((await app.inject({ method: 'POST', url: '/api/tables/bulk', headers: auth(manager), payload: { count: 2 } })).statusCode).toBe(400)
  })

  it('allocates an id for POST /api/tables when none is sent', async () => {
    const manager = await tokenFor('manager')
    const before = await prisma.table.aggregate({ _max: { id: true } })
    const res = await app.inject({ method: 'POST', url: '/api/tables', headers: auth(manager), payload: { category: 'YY' } })
    expect(res.statusCode).toBe(200)
    const table = JSON.parse(res.body).table
    expect(table.id).toBe((before._max.id ?? 0) + 1)
    // Label continues the hall instead of falling back to the bare id.
    expect(table.number).toBe('YY7')
  })
})

describe('hall edit (category update)', () => {
  it('merges into an existing hall by continuing its numbering', async () => {
    const manager = await tokenFor('manager')
    const res = await app.inject({ method: 'POST', url: '/api/tables/category/update', headers: auth(manager), payload: { category: 'YY', newName: 'ZZ' } })
    expect(res.statusCode).toBe(200)
    const rows = await prisma.table.findMany({ where: { category: 'ZZ' }, orderBy: { id: 'asc' } })
    // 8 original ZZ + 7 moved YY, labelled ZZ9..ZZ15 (never restarting at ZZ1).
    expect(rows.length).toBe(15)
    expect(rows.slice(8).map((r) => r.number)).toEqual(['ZZ9', 'ZZ10', 'ZZ11', 'ZZ12', 'ZZ13', 'ZZ14', 'ZZ15'])
  })

  it('grows a hall, restyles it, and straightens drifted labels', async () => {
    const manager = await tokenFor('manager')
    // Drift one label the way a rename used to: "ZZ 1" duplicating "ZZ1".
    const first = await prisma.table.findFirst({ where: { category: 'ZZ' }, orderBy: { id: 'asc' } })
    await prisma.table.update({ where: { id: first!.id }, data: { number: 'ZZ 1' } })

    const res = await app.inject({ method: 'POST', url: '/api/tables/category/update', headers: auth(manager), payload: { category: 'ZZ', count: 17, seats: 8, section: 'Indoor', renumber: true } })
    expect(res.statusCode).toBe(200)

    const rows = await prisma.table.findMany({ where: { category: 'ZZ' }, orderBy: { id: 'asc' } })
    expect(rows.length).toBe(17)
    expect(rows.map((r) => r.number)).toEqual(Array.from({ length: 17 }, (_, i) => `ZZ${i + 1}`))
    expect(new Set(rows.map((r) => r.number)).size).toBe(17)
    // seats/section applied to the pre-existing members.
    expect(rows.slice(0, 15).every((r) => r.seats === 8 && r.section === 'Indoor')).toBe(true)
  })

  it('refuses to shrink a hall (deleting is an explicit per-table action)', async () => {
    const manager = await tokenFor('manager')
    const res = await app.inject({ method: 'POST', url: '/api/tables/category/update', headers: auth(manager), payload: { category: 'ZZ', count: 3 } })
    expect(res.statusCode).toBe(400)
    expect(await prisma.table.count({ where: { category: 'ZZ' } })).toBe(17)
  })
})

describe('table delete guard', () => {
  it('blocks a table with a running order server-side, then deletes and audits it', async () => {
    const admin = await tokenFor('admin')
    const table = await prisma.table.findFirst({ where: { category: 'ZZ' }, orderBy: { id: 'desc' } })
    const order = await prisma.order.create({ data: { orderNumber: 999101, table: table!.id, waiter: 'W', payment: 'Unpaid', cancelled: false } })

    const blocked = await app.inject({ method: 'DELETE', url: `/api/tables/${table!.id}`, headers: auth(admin) })
    expect(blocked.statusCode).toBe(400)
    expect(await prisma.table.count({ where: { id: table!.id } })).toBe(1)

    await prisma.order.update({ where: { id: order.id }, data: { payment: 'Paid' } })
    const ok = await app.inject({ method: 'DELETE', url: `/api/tables/${table!.id}`, headers: auth(admin) })
    expect(ok.statusCode).toBe(200)
    expect(await prisma.table.count({ where: { id: table!.id } })).toBe(0)
    expect(await prisma.auditLogEntry.count({ where: { action: 'TABLE_DELETED' } })).toBeGreaterThan(0)

    await prisma.order.delete({ where: { id: order.id } })
  })

  it('still refuses to delete a locked table', async () => {
    const admin = await tokenFor('admin')
    const res = await app.inject({ method: 'DELETE', url: '/api/tables/301', headers: auth(admin) })
    expect(res.statusCode).toBe(400)
    expect(await prisma.table.count({ where: { id: 301 } })).toBe(1)
  })
})
