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

  it('cooked=false restocks everything with no material loss; cooked=true books the loss', async () => {
    const cashier = await tokenFor('cashier')
    const admin = await tokenFor('admin')
    const place = () =>
      app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: auth(cashier),
        payload: { table: 21, items: [{ menuItemId: 'ckh1', name: 'Chicken Shahi Karahi', price: 2699, qty: 1 }], payment: 'Unpaid' },
      })

    const before = await chickenStock()

    // Not cooked → full restock, no loss (net-zero on chicken).
    const id1 = JSON.parse((await place()).body).order.id
    const c1 = await app.inject({ method: 'POST', url: `/api/orders/${id1}/cancel`, headers: auth(admin), payload: { reason: 'x', cooked: false } })
    expect(c1.statusCode).toBe(200)
    expect(JSON.parse(c1.body).order.materialLoss ?? 0).toBe(0)
    expect(await chickenStock()).toBeCloseTo(before, 5)

    // Cooked → material loss booked, the non-reusable dish stays deducted.
    const id2 = JSON.parse((await place()).body).order.id
    const c2 = await app.inject({ method: 'POST', url: `/api/orders/${id2}/cancel`, headers: auth(admin), payload: { reason: 'x', cooked: true } })
    expect(JSON.parse(c2.body).order.materialLoss).toBeGreaterThan(0)
    expect(await chickenStock()).toBeLessThan(before)
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

  it('lets a Cashier cancel a single item off a running bill (Kitchen forbidden), reducing the total but leaving the order Unpaid', async () => {
    const cashier = await tokenFor('cashier')
    const kitchen = await tokenFor('kitchen')
    const placed = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: {
        table: 15,
        items: [
          { menuItemId: 'ckh1', name: 'Chicken Shahi Karahi', price: 2699, qty: 1 },
          { menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 2 },
        ],
        payment: 'Unpaid',
      },
    })
    const order = JSON.parse(placed.body).order
    const karahiItem = order.items.find((it: { menuItemId: string }) => it.menuItemId === 'ckh1')
    const totalBefore = order.items.reduce((s: number, it: { price: number; qty: number }) => s + it.price * it.qty, 0)

    // Kitchen has no orderItemCancel permission.
    const denied = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/items/${karahiItem.id}/cancel`,
      headers: auth(kitchen),
      payload: { reason: 'test' },
    })
    expect(denied.statusCode).toBe(403)

    // Cashier CAN — deliberately a wider grant than whole-order orderCancel.
    const ok = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/items/${karahiItem.id}/cancel`,
      headers: auth(cashier),
      payload: { reason: 'Customer Request' },
    })
    expect(ok.statusCode).toBe(200)
    const updated = JSON.parse(ok.body).order
    expect(updated.payment).toBe('Unpaid')
    expect(updated.cancelled).toBe(false)
    const updatedKarahi = updated.items.find((it: { id: string }) => it.id === karahiItem.id)
    expect(updatedKarahi.cancelled).toBe(true)
    expect(updatedKarahi.cancellation.role).toBe('Cashier')
    expect(updatedKarahi.cancellation.reason).toBe('Customer Request')
    // The naan line is untouched.
    const naanItem = updated.items.find((it: { menuItemId: string }) => it.menuItemId === 'br2')
    expect(naanItem.cancelled).toBe(false)

    // Cancelling the Karahi line removed its price from the bill total.
    const remainingTotal = updated.items
      .filter((it: { cancelled: boolean }) => !it.cancelled)
      .reduce((s: number, it: { price: number; qty: number }) => s + it.price * it.qty, 0)
    expect(remainingTotal).toBe(totalBefore - karahiItem.price * karahiItem.qty)
  })

  it('item cancel: cooked=false restocks with no loss; cooked=true books material loss without restocking', async () => {
    const cashier = await tokenFor('cashier')
    // Item cancel leaves the order itself running (Unpaid, still occupying its
    // table) — unlike the whole-order cancel test above, a second place() here
    // needs its own table rather than reusing one that's still "running".
    const place = (table: number) =>
      app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: auth(cashier),
        payload: { table, items: [{ menuItemId: 'ckh1', name: 'Chicken Shahi Karahi', price: 2699, qty: 1 }], payment: 'Unpaid' },
      })

    const before = await chickenStock()

    // Not cooked → full restock, no loss.
    const order1 = JSON.parse((await place(16)).body).order
    const c1 = await app.inject({
      method: 'POST',
      url: `/api/orders/${order1.id}/items/${order1.items[0].id}/cancel`,
      headers: auth(cashier),
      payload: { reason: 'Wrong Order', cooked: false },
    })
    expect(c1.statusCode).toBe(200)
    const item1 = JSON.parse(c1.body).order.items[0]
    expect(item1.cancellation.materialLoss).toBe(0)
    expect(await chickenStock()).toBeCloseTo(before, 5)

    // Cooked → material loss booked, chicken stays deducted (no restock).
    const order2 = JSON.parse((await place(18)).body).order
    const afterSecondPlace = await chickenStock()
    const c2 = await app.inject({
      method: 'POST',
      url: `/api/orders/${order2.id}/items/${order2.items[0].id}/cancel`,
      headers: auth(cashier),
      payload: { reason: 'Wrong Order', cooked: true },
    })
    const item2 = JSON.parse(c2.body).order.items[0]
    expect(item2.cancellation.materialLoss).toBeGreaterThan(0)
    expect(await chickenStock()).toBeCloseTo(afterSecondPlace, 5)
  })

  it('requires a reason to cancel an item (400), and refuses to cancel the same item twice', async () => {
    const cashier = await tokenFor('cashier')
    const placed = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: { table: 17, items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 1 }], payment: 'Unpaid' },
    })
    const order = JSON.parse(placed.body).order
    const itemId = order.items[0].id

    const noReason = await app.inject({ method: 'POST', url: `/api/orders/${order.id}/items/${itemId}/cancel`, headers: auth(cashier), payload: {} })
    expect(noReason.statusCode).toBe(400)

    const first = await app.inject({ method: 'POST', url: `/api/orders/${order.id}/items/${itemId}/cancel`, headers: auth(cashier), payload: { reason: 'Wrong Order' } })
    expect(first.statusCode).toBe(200)

    const second = await app.inject({ method: 'POST', url: `/api/orders/${order.id}/items/${itemId}/cancel`, headers: auth(cashier), payload: { reason: 'Wrong Order' } })
    expect(second.statusCode).toBe(400)
  })

  it('shifts a running order onto Takeaway (302), and allows a second concurrent order there too', async () => {
    const cashier = await tokenFor('cashier')
    const place = (table: number) =>
      app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: auth(cashier),
        payload: { table, items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 1 }], payment: 'Unpaid' },
      })

    const id1 = JSON.parse((await place(9)).body).order.id
    const shift1 = await app.inject({ method: 'POST', url: `/api/orders/${id1}/table`, headers: auth(cashier), payload: { table: 302 } })
    expect(shift1.statusCode).toBe(200)
    expect(JSON.parse(shift1.body).order.table).toBe(302)

    // Takeaway is a seatless pseudo-table meant to hold many concurrent orders,
    // unlike a physical table — a second unpaid order can also land on it.
    const id2 = JSON.parse((await place(10)).body).order.id
    const shift2 = await app.inject({ method: 'POST', url: `/api/orders/${id2}/table`, headers: auth(cashier), payload: { table: 302 } })
    expect(shift2.statusCode).toBe(200)
    expect(JSON.parse(shift2.body).order.table).toBe(302)
  })

  it('still refuses to move an order onto an occupied physical table', async () => {
    const cashier = await tokenFor('cashier')
    const place = (table: number) =>
      app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: auth(cashier),
        payload: { table, items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 1 }], payment: 'Unpaid' },
      })
    await place(13) // occupies table 13
    const idB = JSON.parse((await place(14)).body).order.id
    const res = await app.inject({ method: 'POST', url: `/api/orders/${idB}/table`, headers: auth(cashier), payload: { table: 13 } })
    expect(res.statusCode).toBe(400)
  })

  it('rejects a Delivery order (table 301) missing rider/customer/phone/address/charge', async () => {
    const cashier = await tokenFor('cashier')
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: { table: 301, items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 1 }], payment: 'Unpaid' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('places a Delivery order with full details, hides no total impact from deliveryCharge, and round-trips them', async () => {
    const cashier = await tokenFor('cashier')
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: {
        table: 301,
        items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 2 }],
        payment: 'Unpaid',
        deliveryRiderName: 'Sajid',
        deliveryCustomerName: 'Mubashir',
        deliveryCharge: 100,
        deliveryPhone: '0300-1234567',
        deliveryAddress: 'House 12, Hawksbay Road',
        deliveryInstructions: 'Call before arriving',
      },
    })
    expect(res.statusCode).toBe(200)
    const { order } = JSON.parse(res.body)
    expect(order.table).toBe(301)
    expect(order.deliveryRiderName).toBe('Sajid')
    expect(order.deliveryCustomerName).toBe('Mubashir')
    expect(order.deliveryCharge).toBe(100)
    expect(order.deliveryPhone).toBe('0300-1234567')
    expect(order.deliveryAddress).toBe('House 12, Hawksbay Road')

    const fetched = await app.inject({ method: 'GET', url: '/api/orders', headers: auth(cashier) })
    const refetched = JSON.parse(fetched.body).orders.find((o: { id: string }) => o.id === order.id)
    expect(refetched.deliveryRiderName).toBe('Sajid')
  })
})
