// Session boundary after Day Closing: an Unpaid order from before the last
// closing must not keep a table occupied, and the closing gate must not let an
// Unpaid order slip past the very first closing (no boundary yet) just because
// it was created on an earlier calendar date — the business day spans two.

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/db/client.js'
import { seed } from '../prisma/seed.js'

let app: FastifyInstance
let admin: string
let cashier: string

// Plain indoor tables, well away from the ones other test files use.
const STALE_A = 150
const STALE_B = 151
const FREE = 152
const ITEM = { menuItemId: 'ckh1', name: 'Chicken Shahi Karahi', price: 2699, qty: 1 }

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}
async function tokenFor(username: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: '1234' } })
  return JSON.parse(res.body).token as string
}
async function placeUnpaid(table: number) {
  return app.inject({
    method: 'POST',
    url: '/api/orders',
    headers: auth(cashier),
    payload: { table, waiter: 'Test', payment: 'Unpaid', method: '—', items: [ITEM] },
  })
}
async function closeDay() {
  return app.inject({ method: 'POST', url: '/api/closings', headers: auth(admin), payload: {} })
}

beforeAll(async () => {
  await seed()
  // Start from a clean slate: no seeded Unpaid order should take part in the
  // pending-bill checks below.
  await prisma.order.updateMany({ where: { payment: 'Unpaid' }, data: { payment: 'Paid', method: 'Cash' } })
  app = buildApp()
  await app.ready()
  admin = await tokenFor('admin')
  cashier = await tokenFor('cashier')
})
afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describe('Day Closing session boundary', () => {
  it('blocks the very first closing on an Unpaid order from a previous calendar date', async () => {
    expect(await prisma.dailyClosing.count()).toBe(0)
    const yesterday = new Date(Date.now() - 26 * 60 * 60 * 1000)
    for (const table of [STALE_A, STALE_B]) {
      const res = await placeUnpaid(table)
      expect(res.statusCode).toBe(200)
      await prisma.order.updateMany({ where: { table, payment: 'Unpaid' }, data: { createdAt: yesterday } })
    }

    const res = await closeDay()
    expect(res.statusCode).toBe(409)
    expect(res.body).toContain('still unpaid')
  })

  it('after a closing, an older Unpaid order neither blocks closing nor occupies its table', async () => {
    // The two backdated orders above now sit before this boundary.
    await prisma.dailyClosing.create({
      data: { date: 'test', closedBy: 'Test', closedByRole: 'Admin', closingTime: new Date(), totalSales: 0, reportJson: '{}', carriedCash: 0 },
    })

    const close = await closeDay()
    expect(close.body).not.toContain('still unpaid')

    const order = await placeUnpaid(STALE_A)
    expect(order.statusCode).toBe(200)
  })

  it('lets a current-session order move onto a table held only by an older Unpaid order', async () => {
    const placed = await placeUnpaid(FREE)
    expect(placed.statusCode).toBe(200)
    const { order } = JSON.parse(placed.body)

    const moved = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/table`,
      headers: auth(cashier),
      payload: { table: STALE_B },
    })
    expect(moved.statusCode).toBe(200)
  })

  it('still locks a table and blocks closing for an Unpaid order inside the session', async () => {
    // STALE_A now holds the current-session order placed in the second test.
    const second = await placeUnpaid(STALE_A)
    expect(second.statusCode).not.toBe(200)
    expect(second.body).toContain('already has a running order')

    const close = await closeDay()
    expect(close.statusCode).toBe(409)
    expect(close.body).toContain('still unpaid')
  })
})
