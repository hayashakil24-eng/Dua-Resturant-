// Cross-domain smoke test for the Phase 1 config/inventory/recipe/shift/
// receivable routes: verifies each domain's happy path, a representative
// permission denial, and the settings→order GST-lock integration — all through
// the real HTTP stack. Reseeds the shared dev DB first for a known baseline.

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/db/client.js'
import { seed } from '../prisma/seed.js'

let app: FastifyInstance
const tokens: Record<string, string> = {}

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}
async function tokenFor(username: string) {
  if (tokens[username]) return tokens[username]!
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: '1234' } })
  tokens[username] = JSON.parse(res.body).token
  return tokens[username]!
}
function post(url: string, token: string, payload?: unknown) {
  return app.inject({ method: 'POST', url, headers: auth(token), payload: payload as object })
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

describe('inventory + separation of duties', () => {
  it('lets Manager add stock but forbids a Cashier', async () => {
    const manager = await tokenFor('manager')
    const cashier = await tokenFor('cashier')

    const ok = await post('/api/inventory/INV03/restock', manager, { amount: 5 })
    expect(ok.statusCode).toBe(200)

    const denied = await post('/api/inventory/INV03/adjust', cashier, { delta: -1 })
    expect(denied.statusCode).toBe(403)
  })

  // A purchase must move stock AND money in one step — the whole point of the
  // /purchase route existing separately from /adjust, which serves corrections
  // where nothing was bought and so must never book an expense.
  it('books a stock purchase as a dated expense and raises the quantity', async () => {
    const manager = await tokenFor('manager')
    const before = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: 'INV03' } })

    const res = await post('/api/inventory/INV03/purchase', manager, {
      quantity: 4,
      unitCost: 250,
      supplier: 'Karachi Wholesale',
      date: '2026-03-14T00:00:00',
    })
    expect(res.statusCode).toBe(200)
    const { item, purchase } = JSON.parse(res.body)

    expect(item.stock).toBe(before.stock + 4)
    expect(purchase.totalCost).toBe(1000)
    expect(purchase.transactionId).toBeTruthy()

    const txn = await prisma.transaction.findUniqueOrThrow({ where: { id: purchase.transactionId } })
    expect(txn.type).toBe('expense')
    expect(txn.amount).toBe(1000)
    expect(txn.source).toBe('purchase')
    // Booked on the purchase date, not today — reports scope by exact day.
    expect(txn.date.getFullYear()).toBe(2026)
    expect(txn.date.getMonth()).toBe(2)
  })

  it('uses the stated bill total over qty x rate, and rejects a zero-cost purchase', async () => {
    const manager = await tokenFor('manager')
    const ok = await post('/api/inventory/INV03/purchase', manager, { quantity: 3, unitCost: 100, totalCost: 340 })
    expect(ok.statusCode).toBe(200)
    expect(JSON.parse(ok.body).purchase.totalCost).toBe(340)

    const bad = await post('/api/inventory/INV03/purchase', manager, { quantity: 2, unitCost: 0 })
    expect(bad.statusCode).toBe(400)
  })

  it('forbids Admin from purchasing stock (inventoryAdd is Manager-only)', async () => {
    const admin = await tokenFor('admin')
    const res = await post('/api/inventory/INV03/purchase', admin, { quantity: 1, unitCost: 100 })
    expect(res.statusCode).toBe(403)
  })

  it('lets Admin create a new inventory item', async () => {
    const admin = await tokenFor('admin')
    const res = await post('/api/inventory', admin, { name: 'Green Chilli', category: 'Vegetables', unit: 'kg', stock: 3, threshold: 1, costPerUnit: 200 })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).item.id).toMatch(/^INV\d+$/)
  })
})

describe('salary advances hit the ledger', () => {
  it('books an advance as a dated expense and retracts it on delete', async () => {
    const admin = await tokenFor('admin')
    const member = await prisma.staff.findFirstOrThrow({ where: { active: true } })

    const res = await post('/api/advances', admin, {
      staffId: member.id,
      amount: 5000,
      reason: 'Medical',
      date: '2026-03-14T00:00:00',
    })
    expect(res.statusCode).toBe(200)
    const { advance } = JSON.parse(res.body)
    expect(advance.transactionId).toBeTruthy()

    const txn = await prisma.transaction.findUniqueOrThrow({ where: { id: advance.transactionId } })
    expect(txn.type).toBe('expense')
    expect(txn.amount).toBe(5000)
    expect(txn.source).toBe('advance')

    // Deleting the advance must take its expense with it, or the ledger keeps
    // charging for money that was never handed over.
    const del = await app.inject({ method: 'DELETE', url: `/api/advances/${advance.id}`, headers: auth(admin) })
    expect(del.statusCode).toBe(200)
    expect(await prisma.transaction.findUnique({ where: { id: advance.transactionId } })).toBeNull()
  })
})

describe('recipes: Kitchen authors, only Admin approves', () => {
  it('creates a pending recipe (Kitchen) and approves it (Admin); Manager cannot approve', async () => {
    const kitchen = await tokenFor('kitchen')
    const created = await post('/api/recipes', kitchen, {
      menuItemId: 'br2',
      menuItemName: 'Garlic Naan',
      ingredients: [{ inventoryItemId: 'INV01', quantity: 0.1, unit: 'kg' }],
    })
    expect(created.statusCode).toBe(200)
    const recipeId = JSON.parse(created.body).recipe.id

    const managerDenied = await post(`/api/recipes/${recipeId}/approve`, await tokenFor('manager'))
    expect(managerDenied.statusCode).toBe(403)

    const approved = await post(`/api/recipes/${recipeId}/approve`, await tokenFor('admin'))
    expect(approved.statusCode).toBe(200)
    expect(JSON.parse(approved.body).recipe.status).toBe('approved')
  })
})

describe('shifts: attribution + reconciliation', () => {
  it('attributes a paid order to the open shift and reconciles as matched', async () => {
    const cashier = await tokenFor('cashier')
    const start = await post('/api/shifts/start', cashier, { openingCash: 1000 })
    expect(start.statusCode).toBe(200)
    const shiftId = JSON.parse(start.body).shift.id

    // Cash sale of a Garlic Naan (150) with GST off → total 150.
    await post('/api/orders', cashier, { table: 12, payment: 'Paid', method: 'Cash', items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 1 }] })

    const end = await post(`/api/shifts/${shiftId}/end`, cashier, { actualCash: 1150 })
    expect(end.statusCode).toBe(200)
    const shift = JSON.parse(end.body).shift
    expect(shift.expectedCash).toBe(1150)
    expect(shift.status).toBe('matched')
  })
})

describe('receivables + udhaar', () => {
  it('converts an unpaid order to udhaar, creating a receivable balance', async () => {
    const cashier = await tokenFor('cashier')
    const manager = await tokenFor('manager')
    const placed = await post('/api/orders', cashier, { table: 20, payment: 'Unpaid', items: [{ menuItemId: 'pk5', name: 'Biryani', price: 700, qty: 2 }] })
    const orderId = JSON.parse(placed.body).order.id

    const udhaar = await post(`/api/orders/${orderId}/udhaar`, manager, { customerName: 'Test Customer' })
    expect(udhaar.statusCode).toBe(200)
    const body = JSON.parse(udhaar.body)
    expect(body.order.payment).toBe('Udhaar')

    const pay = await post(`/api/receivables/${body.accountId}/payment`, manager, { amount: 700 })
    expect(pay.statusCode).toBe(200)
    expect(JSON.parse(pay.body).settled).toBe(false) // 1400 - 700 = 700 remaining
  })
})

describe('table shift', () => {
  it('moves a running order to a free table but refuses one that is already in use', async () => {
    const cashier = await tokenFor('cashier')
    const a = await post('/api/orders', cashier, { table: 41, payment: 'Unpaid', items: [{ menuItemId: 'pk5', name: 'Biryani', price: 700, qty: 1 }] })
    const b = await post('/api/orders', cashier, { table: 42, payment: 'Unpaid', items: [{ menuItemId: 'pk5', name: 'Biryani', price: 700, qty: 1 }] })
    const orderA = JSON.parse(a.body).order.id
    const orderB = JSON.parse(b.body).order.id

    // 42 already holds orderB — moving orderA onto it must be rejected.
    const blocked = await post(`/api/orders/${orderA}/table`, cashier, { table: 42 })
    expect(blocked.statusCode).toBe(400)
    expect(JSON.parse(blocked.body).error).toMatch(/running order/i)

    // 43 is free, so the same move succeeds.
    const ok = await post(`/api/orders/${orderA}/table`, cashier, { table: 43 })
    expect(ok.statusCode).toBe(200)
    expect(JSON.parse(ok.body).order.table).toBe(43)

    // Once orderB is paid, table 42 frees up and becomes a valid destination.
    await post(`/api/orders/${orderB}/pay`, cashier, { method: 'Cash' })
    const afterPaid = await post(`/api/orders/${orderA}/table`, cashier, { table: 42 })
    expect(afterPaid.statusCode).toBe(200)

    // Settle orderA too — the daily-closing test below refuses to close while
    // any same-day bill is still unpaid.
    await post(`/api/orders/${orderA}/pay`, cashier, { method: 'Cash' })
  })
})

describe('settings → order GST lock', () => {
  it('locks the live GST rate onto an order at creation', async () => {
    const admin = await tokenFor('admin')
    const cashier = await tokenFor('cashier')

    await post('/api/settings/gst', admin, { enabled: true })
    await post('/api/settings/gst-rate', admin, { pct: 10 })

    const placed = await post('/api/orders', cashier, { table: 30, payment: 'Unpaid', items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 1 }] })
    expect(JSON.parse(placed.body).order.gstRate).toBe(0.1)

    await post('/api/settings/gst', admin, { enabled: false })
    // Resolve the order this test placed — otherwise it lingers as a same-day
    // Unpaid order and trips the daily-closing pending-bill block (below) for
    // any test that happens to run after this one.
    await post(`/api/orders/${JSON.parse(placed.body).order.id}/pay`, cashier, { method: 'Cash' })
  })

  it('forbids a Cashier from changing settings', async () => {
    const cashier = await tokenFor('cashier')
    const res = await post('/api/settings/gst', cashier, { enabled: true })
    expect(res.statusCode).toBe(403)
  })
})

describe('accounting', () => {
  it('adds a transaction (Admin) and denies a Cashier', async () => {
    const admin = await tokenFor('admin')
    const cashier = await tokenFor('cashier')
    const ok = await post('/api/transactions', admin, { type: 'expense', category: 'Supplies', amount: 5000, description: 'Test' })
    expect(ok.statusCode).toBe(200)
    expect(JSON.parse(ok.body).transaction.txnNumber).toBeGreaterThan(0)

    const denied = await post('/api/transactions', cashier, { type: 'expense', category: 'x', amount: 1 })
    expect(denied.statusCode).toBe(403)
  })
})

// A Manager punches and settles orders, but must never run a cash drawer:
// they are the one who RECEIVES handovers, and someone who both hands cash
// over and signs for it defeats the chain. 'drawer' is therefore its own
// permission rather than being implied by 'pos'/'billing'.
describe('manager can punch and settle orders but not run a drawer', () => {
  it('allows placing and paying an order, and refuses every drawer action', async () => {
    const manager = await tokenFor('manager')

    const placed = await post('/api/orders', manager, {
      table: 27,
      payment: 'Unpaid',
      items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 2 }],
    })
    expect(placed.statusCode).toBe(200)
    const orderId = JSON.parse(placed.body).order.id

    const paid = await post(`/api/orders/${orderId}/pay`, manager, { method: 'Cash' })
    expect(paid.statusCode).toBe(200)
    expect(JSON.parse(paid.body).order.payment).toBe('Paid')

    // No drawer, and no cashier-side handover (they use /forward instead).
    expect((await post('/api/shifts/start', manager, { openingCash: 1000 })).statusCode).toBe(403)
    expect((await post('/api/shifts/pause', manager)).statusCode).toBe(403)
    expect((await post('/api/handovers', manager, { amount: 100, toRole: 'Admin' })).statusCode).toBe(403)
  })
})

describe('daily closing', () => {
  it('builds a server-side closing report for today', async () => {
    const admin = await tokenFor('admin')
    const res = await app.inject({ method: 'GET', url: '/api/closing/report', headers: auth(admin) })
    expect(res.statusCode).toBe(200)
    const { report } = JSON.parse(res.body)
    expect(report).toHaveProperty('netSale')
    expect(report).toHaveProperty('inventoryUsed')
    expect(report).toHaveProperty('expensesByCategory')
  })

  it('blocks saving a closing while a same-day bill is still unpaid, and allows it once resolved', async () => {
    const admin = await tokenFor('admin')
    const cashier = await tokenFor('cashier')

    const order = await post('/api/orders', cashier, {
      table: 3,
      payment: 'Unpaid',
      items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 1 }],
    })
    const orderId = JSON.parse(order.body).order.id

    const blocked = await post('/api/closings', admin)
    expect(blocked.statusCode).toBe(409)
    expect(JSON.parse(blocked.body).error).toMatch(/unpaid/i)

    const comp = await post(`/api/orders/${orderId}/complimentary`, admin, { orderedBy: 'Admin', reason: 'test cleanup' })
    expect(comp.statusCode).toBe(200)

    const saved = await post('/api/closings', admin)
    expect(saved.statusCode).toBe(200)
  })

  // A DailyClosing row stores only its END instant, so the window a saved
  // closing covers is derived: newest-first, each row starts where the next
  // older one ended. This is what lets Reports scope by session instead of by
  // calendar date. Depends on the closing saved by the test above.
  it('derives each saved closing recording window from the previous closing', async () => {
    const admin = await tokenFor('admin')
    const cashier = await tokenFor('cashier')

    // New activity — an empty session can't be re-closed (the day lock).
    await post('/api/orders', cashier, {
      table: 33,
      payment: 'Paid',
      method: 'Cash',
      items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 1 }],
    })
    expect((await post('/api/closings', admin)).statusCode).toBe(200)

    const list = await app.inject({ method: 'GET', url: '/api/closings', headers: auth(admin) })
    expect(list.statusCode).toBe(200)
    const { closings } = JSON.parse(list.body)
    expect(closings.length).toBeGreaterThanOrEqual(2)

    expect(closings[0].periodStart).toBe(closings[1].closingTime)
    expect(closings[0].periodEnd).toBe(closings[0].closingTime)
    // The oldest closing has no predecessor — it was calendar-day scoped.
    expect(closings[closings.length - 1].periodStart).toBeNull()
  })
})
