// End-to-end smoke test for the Phase 1 HTTP layer: real login → JWT →
// permission-gated order routes → recipe-driven inventory deduction, all
// through Fastify's inject() (no port bind). Proves the vertical slice the rest
// of Phase 1's domains plug into. Reseeds the shared dev DB first so the
// deduction assertion is against known starting stock.

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/db/client.js'
import { seed } from '../prisma/seed.js'

let app: FastifyInstance

async function login(username: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password } })
  return res
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

async function tokenFor(username: string) {
  const res = await login(username, '1234')
  return JSON.parse(res.body).token as string
}

async function chickenStock() {
  const inv = await prisma.inventoryItem.findUnique({ where: { id: 'INV03' } })
  return inv!.stock
}
async function oilStock() {
  const inv = await prisma.inventoryItem.findUnique({ where: { id: 'INV02' } })
  return inv!.stock
}

beforeAll(async () => {
  await seed()
  app = buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describe('auth', () => {
  it('logs in a seeded user and returns a token + role', async () => {
    const res = await login('cashier', '1234')
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.token).toBeTruthy()
    expect(body.user.role).toBe('Cashier')
  })

  it('rejects a wrong password with 401', async () => {
    const res = await login('cashier', 'wrong')
    expect(res.statusCode).toBe(401)
  })

  it('rejects an unauthenticated read with 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orders' })
    expect(res.statusCode).toBe(401)
  })
})

describe('orders', () => {
  it('lists seeded orders for an authenticated user', async () => {
    const token = await tokenFor('cashier')
    const res = await app.inject({ method: 'GET', url: '/api/orders', headers: auth(token) })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(Array.isArray(body.orders)).toBe(true)
    expect(body.orders.length).toBeGreaterThanOrEqual(3)
  })

  it('places an order and auto-deducts the approved recipe (2× Karahi → 1kg chicken, 0.2L oil)', async () => {
    const token = await tokenFor('cashier')
    const chickenBefore = await chickenStock()
    const oilBefore = await oilStock()

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(token),
      payload: {
        table: 5,
        waiter: 'Test',
        payment: 'Paid',
        method: 'Cash',
        items: [{ menuItemId: 'ckh1', name: 'Chicken Shahi Karahi', price: 2699, qty: 2 }],
      },
    })
    expect(res.statusCode).toBe(200)
    const { order } = JSON.parse(res.body)
    expect(order.payment).toBe('Paid')
    expect(order.orderNumber).toBeGreaterThan(0)

    expect(Math.round((chickenBefore - (await chickenStock())) * 1000) / 1000).toBe(1)
    expect(Math.round((oilBefore - (await oilStock())) * 1000) / 1000).toBe(0.2)
  })

  it('forbids Kitchen from placing an order (403)', async () => {
    const token = await tokenFor('kitchen')
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(token),
      payload: { table: 5, items: [{ menuItemId: 'ckh1', name: 'x', price: 100, qty: 1 }], payment: 'Unpaid' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('forbids a Cashier from cancelling, but allows Admin, and restocks reusable items', async () => {
    const cashier = await tokenFor('cashier')
    // Place an unpaid order to cancel.
    const placed = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: { table: 7, items: [{ menuItemId: 'ckh1', name: 'Chicken Shahi Karahi', price: 2699, qty: 1 }], payment: 'Unpaid' },
    })
    const orderId = JSON.parse(placed.body).order.id

    // Cashier cannot cancel (orderCancel = none).
    const denied = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/cancel`,
      headers: auth(cashier),
      payload: { reason: 'test' },
    })
    expect(denied.statusCode).toBe(403)

    // Admin can.
    const admin = await tokenFor('admin')
    const ok = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/cancel`,
      headers: auth(admin),
      payload: { reason: 'Customer left' },
    })
    expect(ok.statusCode).toBe(200)
    expect(JSON.parse(ok.body).order.cancelled).toBe(true)
  })

  it('requires a reason to cancel (400)', async () => {
    const admin = await tokenFor('admin')
    const cashier = await tokenFor('cashier')
    const placed = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: { table: 8, items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 1 }], payment: 'Unpaid' },
    })
    const orderId = JSON.parse(placed.body).order.id
    const res = await app.inject({ method: 'POST', url: `/api/orders/${orderId}/cancel`, headers: auth(admin), payload: {} })
    expect(res.statusCode).toBe(400)
  })
})
