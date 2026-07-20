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

  it('lets Admin create a new inventory item', async () => {
    const admin = await tokenFor('admin')
    const res = await post('/api/inventory', admin, { name: 'Green Chilli', category: 'Vegetables', unit: 'kg', stock: 3, threshold: 1, costPerUnit: 200 })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).item.id).toMatch(/^INV\d+$/)
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
})
