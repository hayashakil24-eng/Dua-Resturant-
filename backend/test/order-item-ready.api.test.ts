// Per-item KDS ready: a multi-item order flips to 'Ready' only once every line
// is ticked, and drops back to 'Pending' if a ready order has a line un-ticked.

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
  app = buildApp()
  await app.ready()
})
afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describe('per-item KDS ready', () => {
  it('order goes Ready only when all lines are ticked, and back to Pending on un-tick', async () => {
    const cashier = await tokenFor('cashier')
    const kitchen = await tokenFor('kitchen')

    const created = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: {
        table: 11,
        payment: 'Unpaid',
        items: [
          { menuItemId: 'ckh1', name: 'Chicken Shahi Karahi', price: 2699, qty: 1 },
          { menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 2 },
        ],
      },
    })
    expect(created.statusCode).toBe(200)
    const order = JSON.parse(created.body).order
    expect(order.kitchen).toBe('Pending')
    const [a, b] = order.items
    expect(a.ready).toBe(false)

    // Tick the first line — order still Pending, that line ready.
    const r1 = await app.inject({ method: 'POST', url: `/api/orders/${order.id}/items/${a.itemId}/ready`, headers: auth(kitchen) })
    expect(r1.statusCode).toBe(200)
    let body = JSON.parse(r1.body).order
    expect(body.kitchen).toBe('Pending')
    expect(body.items.find((it: { itemId: string }) => it.itemId === a.itemId).ready).toBe(true)

    // Tick the second — now every line is ready, so the order auto-flips.
    const r2 = await app.inject({ method: 'POST', url: `/api/orders/${order.id}/items/${b.itemId}/ready`, headers: auth(kitchen) })
    body = JSON.parse(r2.body).order
    expect(body.kitchen).toBe('Ready')

    // Un-tick one — a ready order drops back to Pending (mis-tap is recoverable).
    const r3 = await app.inject({ method: 'POST', url: `/api/orders/${order.id}/items/${a.itemId}/ready`, headers: auth(kitchen) })
    body = JSON.parse(r3.body).order
    expect(body.kitchen).toBe('Pending')
    expect(body.items.find((it: { itemId: string }) => it.itemId === a.itemId).ready).toBe(false)
  })
})
