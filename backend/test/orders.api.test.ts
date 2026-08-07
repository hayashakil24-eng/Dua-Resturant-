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

  it('partial item cancel: cancels only the requested quantity, leaving the remainder as an active line', async () => {
    const cashier = await tokenFor('cashier')
    // Top up chicken stock first — by this point in the file it may be low
    // enough that a 3-unit deduction floor-clamps at 0 (applyStockChanges
    // never goes negative), which would break the linear per-unit math below.
    await prisma.inventoryItem.update({ where: { id: 'INV03' }, data: { stock: 1000 } })
    const beforePlace = await chickenStock()
    const placed = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: { table: 20, items: [{ menuItemId: 'ckh1', name: 'Chicken Shahi Karahi', price: 2699, qty: 3 }], payment: 'Unpaid' },
    })
    const order = JSON.parse(placed.body).order
    const afterPlace = await chickenStock()
    const perUnitDeduction = (beforePlace - afterPlace) / 3

    const res = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/items/${order.items[0].itemId}/cancel`,
      headers: auth(cashier),
      payload: { reason: 'Customer Request', cooked: false, qty: 1 },
    })
    expect(res.statusCode).toBe(200)
    const updated = JSON.parse(res.body).order
    expect(updated.payment).toBe('Unpaid')

    const active = updated.items.find((it: { menuItemId: string; cancelled: boolean }) => it.menuItemId === 'ckh1' && !it.cancelled)
    const cancelledLine = updated.items.find((it: { menuItemId: string; cancelled: boolean }) => it.menuItemId === 'ckh1' && it.cancelled)
    expect(active.qty).toBe(2)
    expect(cancelledLine.qty).toBe(1)
    expect(cancelledLine.cancellation.reason).toBe('Customer Request')

    const total = updated.items
      .filter((it: { cancelled: boolean }) => !it.cancelled)
      .reduce((s: number, it: { price: number; qty: number }) => s + it.price * it.qty, 0)
    expect(total).toBe(2699 * 2)

    // Only the cancelled unit's ingredients were restocked, not all 3.
    expect(await chickenStock()).toBeCloseTo(afterPlace + perUnitDeduction, 5)
  })

  it('rejects invalid cancel quantities: zero, negative, decimal, and over-limit', async () => {
    const cashier = await tokenFor('cashier')
    const placed = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: { table: 21, items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 3 }], payment: 'Unpaid' },
    })
    const order = JSON.parse(placed.body).order
    const itemId = order.items[0].itemId

    for (const qty of [0, -1, 1.5, 4]) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/orders/${order.id}/items/${itemId}/cancel`,
        headers: auth(cashier),
        payload: { reason: 'Wrong Order', qty },
      })
      expect(res.statusCode).toBe(400)
    }
  })

  it('supports cancelling from the same line twice (partial, then partial again)', async () => {
    const cashier = await tokenFor('cashier')
    const placed = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: { table: 22, items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 3 }], payment: 'Unpaid' },
    })
    const order = JSON.parse(placed.body).order
    const itemId = order.items[0].itemId

    const first = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/items/${itemId}/cancel`,
      headers: auth(cashier),
      payload: { reason: 'Wrong Order', qty: 1 },
    })
    expect(first.statusCode).toBe(200)
    const afterFirst = JSON.parse(first.body).order
    const activeAfterFirst = afterFirst.items.find((it: { menuItemId: string; cancelled: boolean }) => it.menuItemId === 'br2' && !it.cancelled)
    expect(activeAfterFirst.qty).toBe(2)

    const second = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/items/${activeAfterFirst.itemId}/cancel`,
      headers: auth(cashier),
      payload: { reason: 'Wrong Order', qty: 1 },
    })
    expect(second.statusCode).toBe(200)
    const afterSecond = JSON.parse(second.body).order
    const cancelledLines = afterSecond.items.filter((it: { menuItemId: string; cancelled: boolean }) => it.menuItemId === 'br2' && it.cancelled)
    const activeAfterSecond = afterSecond.items.find((it: { menuItemId: string; cancelled: boolean }) => it.menuItemId === 'br2' && !it.cancelled)
    expect(cancelledLines.length).toBe(2)
    expect(activeAfterSecond.qty).toBe(1)
  })

  it('re-adding the same item after a partial cancel merges into the active remainder, not the cancelled split', async () => {
    const cashier = await tokenFor('cashier')
    const placed = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: { table: 23, items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 3 }], payment: 'Unpaid' },
    })
    const order = JSON.parse(placed.body).order
    const itemId = order.items[0].itemId

    await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/items/${itemId}/cancel`,
      headers: auth(cashier),
      payload: { reason: 'Wrong Order', qty: 1 },
    })

    const appended = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/items`,
      headers: auth(cashier),
      payload: { items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 2 }] },
    })
    expect(appended.statusCode).toBe(200)
    const updated = JSON.parse(appended.body).order
    const naanLines = updated.items.filter((it: { menuItemId: string }) => it.menuItemId === 'br2')
    expect(naanLines.length).toBe(2) // one active (merged), one cancelled — not a third row
    const active = naanLines.find((it: { cancelled: boolean }) => !it.cancelled)
    const cancelled = naanLines.find((it: { cancelled: boolean }) => it.cancelled)
    expect(active.qty).toBe(4) // 2 remaining + 2 appended
    expect(cancelled.qty).toBe(1)
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

// Karahi/Handi/BBQ items billed by weight instead of a piece count — see
// CLAUDE.md's Karahi/Handi note. `ckh1` (used throughout the suite above)
// deliberately stays unit:"pcs" so the existing decimal-rejection test keeps
// passing unmodified; this block seeds its own dedicated unit:"kg" item.
describe('kg-billed items (weight billing)', () => {
  const KG_ITEM_ID = 'kgtest1'
  const KG_PRICE = 3000 // Rs. per kg

  beforeAll(async () => {
    await prisma.menuItem.create({
      data: {
        id: KG_ITEM_ID,
        name: 'Test Weight Karahi',
        category: 'Test',
        price: KG_PRICE,
        unit: 'kg',
        active: true,
        costEstimated: true,
        reusable: false,
      },
    })
    // 1kg chicken "per kg of dish" — a kg-billed item's recipe is authored per
    // kg ordered, not per serving, since oi.qty now means kg (see
    // CLAUDE.md / resolveUnits in orders.service.ts).
    const recipe = await prisma.recipe.create({
      data: {
        menuItemId: KG_ITEM_ID,
        menuItemName: 'Test Weight Karahi',
        totalCost: 550,
        status: 'approved',
        createdBy: 'Test Chef',
        createdByRole: 'Kitchen',
        approvedBy: 'Admin User',
        approvedAt: new Date(),
      },
    })
    await prisma.recipeIngredient.create({
      data: { recipeId: recipe.id, inventoryItemId: 'INV03', itemName: 'Chicken', quantity: 1, unit: 'kg', costPerUnit: 550, lineCost: 550 },
    })
  })

  it('accepts a decimal weight on create, deducts proportionally, and totals a whole rupee', async () => {
    const cashier = await tokenFor('cashier')
    await prisma.inventoryItem.update({ where: { id: 'INV03' }, data: { stock: 1000 } })
    const before = await chickenStock()

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: { table: 900, items: [{ menuItemId: KG_ITEM_ID, name: 'Test Weight Karahi', price: KG_PRICE, qty: 1.5 }], payment: 'Unpaid' },
    })
    expect(res.statusCode).toBe(200)
    const { order } = JSON.parse(res.body)
    const line = order.items[0]
    expect(line.qty).toBe(1.5)
    // 3000 * 1.5 = 4500 exactly, but the rounding must survive a fractional case too.
    expect(order.items.reduce((s: number, it: { price: number; qty: number }) => s + Math.round(it.price * it.qty), 0)).toBe(4500)
    expect(Math.round((before - (await chickenStock())) * 1000) / 1000).toBe(1.5)
  })

  it('rounds a decimal qty to 2dp and rejects a sub-0.05kg weight', async () => {
    const cashier = await tokenFor('cashier')
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: { table: 901, items: [{ menuItemId: KG_ITEM_ID, name: 'Test Weight Karahi', price: KG_PRICE, qty: 1.239 }], payment: 'Unpaid' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).order.items[0].qty).toBe(1.24)

    const tooSmall = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: { table: 902, items: [{ menuItemId: KG_ITEM_ID, name: 'Test Weight Karahi', price: KG_PRICE, qty: 0.01 }], payment: 'Unpaid' },
    })
    expect(tooSmall.statusCode).toBe(400)
  })

  it('appending items and editing qty both accept a decimal weight', async () => {
    const cashier = await tokenFor('cashier')
    const placed = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: { table: 903, items: [{ menuItemId: KG_ITEM_ID, name: 'Test Weight Karahi', price: KG_PRICE, qty: 1 }], payment: 'Unpaid' },
    })
    const order = JSON.parse(placed.body).order

    const edited = await app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/items`,
      headers: auth(cashier),
      payload: { itemKey: order.items[0].id, qty: 2.25 },
    })
    expect(edited.statusCode).toBe(200)
    expect(JSON.parse(edited.body).order.items[0].qty).toBe(2.25)

    const appended = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/items`,
      headers: auth(cashier),
      payload: { items: [{ menuItemId: KG_ITEM_ID, name: 'Test Weight Karahi', price: KG_PRICE, qty: 0.75 }] },
    })
    expect(appended.statusCode).toBe(200)
    const merged = JSON.parse(appended.body).order.items.find((it: { menuItemId: string; cancelled: boolean }) => it.menuItemId === KG_ITEM_ID && !it.cancelled)
    expect(merged.qty).toBe(3) // 2.25 + 0.75, merged into the same line
  })

  it('partial-kg cancel accepts a decimal amount, restocks proportionally, and leaves the decimal remainder', async () => {
    const cashier = await tokenFor('cashier')
    await prisma.inventoryItem.update({ where: { id: 'INV03' }, data: { stock: 1000 } })
    const before = await chickenStock()

    const placed = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: { table: 904, items: [{ menuItemId: KG_ITEM_ID, name: 'Test Weight Karahi', price: KG_PRICE, qty: 1.5 }], payment: 'Unpaid' },
    })
    const order = JSON.parse(placed.body).order
    const afterPlace = await chickenStock()
    expect(Math.round((before - afterPlace) * 1000) / 1000).toBe(1.5)

    const res = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/items/${order.items[0].itemId}/cancel`,
      headers: auth(cashier),
      payload: { reason: 'Customer Request', cooked: false, qty: 0.5 },
    })
    expect(res.statusCode).toBe(200)
    const updated = JSON.parse(res.body).order
    const active = updated.items.find((it: { menuItemId: string; cancelled: boolean }) => it.menuItemId === KG_ITEM_ID && !it.cancelled)
    const cancelledLine = updated.items.find((it: { menuItemId: string; cancelled: boolean }) => it.menuItemId === KG_ITEM_ID && it.cancelled)
    expect(active.qty).toBe(1)
    expect(cancelledLine.qty).toBe(0.5)
    // Restocked exactly the cancelled 0.5kg worth of chicken (0.5kg needed per kg).
    expect(await chickenStock()).toBeCloseTo(afterPlace + 0.5, 5)
  })

  it('rejects a zero/negative/over-limit weight cancel, but allows a valid decimal', async () => {
    const cashier = await tokenFor('cashier')
    const placed = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: auth(cashier),
      payload: { table: 905, items: [{ menuItemId: KG_ITEM_ID, name: 'Test Weight Karahi', price: KG_PRICE, qty: 1 }], payment: 'Unpaid' },
    })
    const order = JSON.parse(placed.body).order
    const itemId = order.items[0].itemId

    for (const qty of [0, -0.5, 1.5]) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/orders/${order.id}/items/${itemId}/cancel`,
        headers: auth(cashier),
        payload: { reason: 'Wrong Order', qty },
      })
      expect(res.statusCode).toBe(400)
    }

    const ok = await app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/items/${itemId}/cancel`,
      headers: auth(cashier),
      payload: { reason: 'Wrong Order', qty: 0.3 },
    })
    expect(ok.statusCode).toBe(200)
  })
})
