// Discounts can be given as a percentage of the bill or as a flat rupee figure.
// In percent mode the rupee amount is derived on the server from the order's own
// gross, so a client can never post a percent that doesn't match the money.

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
async function newOrder(token: string, table: number) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/orders',
    headers: auth(token),
    payload: { table, payment: 'Unpaid', items: [{ menuItemId: 'ckh1', name: 'Chicken Shahi Karahi', price: 2000, qty: 1 }] },
  })
  return JSON.parse(res.body).order
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

describe('percentage discount', () => {
  it('derives the rupee amount from the percent and records both', async () => {
    const cashier = await tokenFor('cashier')
    const admin = await tokenFor('admin')
    const order = await newOrder(cashier, 21)
    const gross = order.items.reduce((s: number, it: { price: number; qty: number }) => s + it.price * it.qty, 0)

    const res = await app.inject({ method: 'POST', url: `/api/orders/${order.id}/discount`, headers: auth(admin), payload: { percent: 10, reason: 'VIP Customer' } })
    expect(res.statusCode).toBe(200)
    const discount = JSON.parse(res.body).order.discount
    expect(discount.percent).toBe(10)
    expect(discount.amount).toBe(Math.round(gross * 0.1))
  })

  it('ignores a client-supplied amount when a percent is sent', async () => {
    const cashier = await tokenFor('cashier')
    const admin = await tokenFor('admin')
    const order = await newOrder(cashier, 22)

    const res = await app.inject({ method: 'POST', url: `/api/orders/${order.id}/discount`, headers: auth(admin), payload: { percent: 25, amount: 999999 } })
    expect(res.statusCode).toBe(200)
    const discount = JSON.parse(res.body).order.discount
    expect(discount.amount).toBe(500) // 25% of 2000, not the posted figure
    expect(discount.percent).toBe(25)
  })

  it('rejects percents outside 1..100 and fractional percents', async () => {
    const cashier = await tokenFor('cashier')
    const admin = await tokenFor('admin')
    const order = await newOrder(cashier, 23)
    const bad = async (percent: unknown) =>
      (await app.inject({ method: 'POST', url: `/api/orders/${order.id}/discount`, headers: auth(admin), payload: { percent } })).statusCode

    expect(await bad(0)).toBe(400)
    expect(await bad(101)).toBe(400)
    expect(await bad(12.5)).toBe(400)
    expect(await bad(-5)).toBe(400)
  })

  it('still accepts a flat amount, with no percent recorded, and clears both on remove', async () => {
    const cashier = await tokenFor('cashier')
    const admin = await tokenFor('admin')
    const order = await newOrder(cashier, 24)

    const applied = await app.inject({ method: 'POST', url: `/api/orders/${order.id}/discount`, headers: auth(admin), payload: { amount: 150 } })
    expect(applied.statusCode).toBe(200)
    const discount = JSON.parse(applied.body).order.discount
    expect(discount.amount).toBe(150)
    expect(discount.percent).toBeUndefined()

    const removed = await app.inject({ method: 'DELETE', url: `/api/orders/${order.id}/discount`, headers: auth(admin) })
    expect(removed.statusCode).toBe(200)
    expect(JSON.parse(removed.body).order.discount).toBeUndefined()
    const row = await prisma.order.findUnique({ where: { id: order.id } })
    expect(row?.discountPercent).toBeNull()
  })

  it('takes the percentage off the GST-inclusive total, not the subtotal', async () => {
    const admin = await tokenFor('admin')
    // GST is a per-order locked rate, so build the order directly with one.
    const order = await prisma.order.create({
      data: {
        orderNumber: 999501,
        table: 26,
        waiter: 'W',
        payment: 'Unpaid',
        cancelled: false,
        gstRate: 0.16,
        items: { create: [{ menuItemId: 'ckh1', name: 'Chicken Shahi Karahi', price: 2000, qty: 1 }] },
      },
    })

    const res = await app.inject({ method: 'POST', url: `/api/orders/${order.id}/discount`, headers: auth(admin), payload: { percent: 10 } })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body).order
    // 2000 + 16% GST = 2320 → 10% = 232 (not 200, which would ignore the GST).
    expect(body.discount.amount).toBe(232)
    expect(body.discount.percent).toBe(10)
    expect(body.gstRate).toBe(0.16)

    await prisma.order.delete({ where: { id: order.id } })
  })

  it('is refused for a cashier', async () => {
    const cashier = await tokenFor('cashier')
    const order = await newOrder(cashier, 25)
    const res = await app.inject({ method: 'POST', url: `/api/orders/${order.id}/discount`, headers: auth(cashier), payload: { percent: 10 } })
    expect(res.statusCode).toBe(403)
  })
})
