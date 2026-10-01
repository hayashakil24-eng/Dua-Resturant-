// Add Item with opening stock: "Pay now" must book an Inventory Purchase
// expense (same as Buy Stock's Pay now) and leave supplier payables alone;
// only "Pay later" charges a payable and lands under Credit Purchase on the
// Day Closing report.

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/db/client.js'
import { seed } from '../prisma/seed.js'
import { buildReport } from '../src/services/closing.service.js'

let app: FastifyInstance
let admin: string

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

async function payableTotal() {
  const rows = await prisma.payable.findMany()
  return rows.reduce((s, p) => s + p.balance, 0)
}

async function purchaseExpenseCount() {
  return prisma.transaction.count({ where: { type: 'expense', category: 'Inventory Purchase' } })
}

beforeAll(async () => {
  await seed()
  app = buildApp()
  await app.ready()
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: '1234' } })
  admin = JSON.parse(res.body).token
})
afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describe('Add Item opening stock payment mode', () => {
  it('Pay now books an Inventory Purchase expense and does not touch payables', async () => {
    const reportBefore = await buildReport()
    const payablesBefore = await payableTotal()

    const res = await app.inject({
      method: 'POST',
      url: '/api/inventory',
      headers: auth(admin),
      payload: { name: 'Opening Paid Test', category: 'Other', unit: 'kg', stock: 2, costPerUnit: 500, paid: true },
    })
    expect(res.statusCode).toBe(200)
    const { item } = JSON.parse(res.body)

    const purchase = await prisma.stockPurchase.findFirstOrThrow({ where: { inventoryItemId: item.id } })
    expect(purchase.paymentStatus).toBe('paid')
    expect(purchase.payableId).toBeNull()
    expect(purchase.transactionId).toBeTruthy()

    const txn = await prisma.transaction.findUniqueOrThrow({ where: { id: purchase.transactionId! } })
    expect(txn.type).toBe('expense')
    expect(txn.category).toBe('Inventory Purchase')
    expect(txn.amount).toBe(1000)

    expect(await payableTotal()).toBe(payablesBefore)

    const reportAfter = await buildReport()
    expect(reportAfter.expenses - reportBefore.expenses).toBe(1000)
    expect(reportAfter.cashPurchases - reportBefore.cashPurchases).toBe(1000)
    expect(reportAfter.creditPurchases).toBe(reportBefore.creditPurchases)
    expect(reportAfter.remainingHandover - reportBefore.remainingHandover).toBe(-1000)
  })

  it('Pay later charges the supplier payable and books no expense', async () => {
    const reportBefore = await buildReport()
    const expensesBefore = await purchaseExpenseCount()

    const res = await app.inject({
      method: 'POST',
      url: '/api/inventory',
      headers: auth(admin),
      payload: { name: 'Opening Credit Test', category: 'Other', unit: 'kg', stock: 1, costPerUnit: 200, paid: false, supplier: 'Test Supplier' },
    })
    expect(res.statusCode).toBe(200)
    const { item } = JSON.parse(res.body)

    const purchase = await prisma.stockPurchase.findFirstOrThrow({ where: { inventoryItemId: item.id } })
    expect(purchase.paymentStatus).toBe('unpaid')
    expect(purchase.transactionId).toBeNull()

    const payable = await prisma.payable.findFirstOrThrow({ where: { name: 'Test Supplier' } })
    expect(payable.balance).toBe(200)

    expect(await purchaseExpenseCount()).toBe(expensesBefore)

    const reportAfter = await buildReport()
    expect(reportAfter.creditPurchases - reportBefore.creditPurchases).toBe(200)
    expect(reportAfter.expenses).toBe(reportBefore.expenses)
    expect(reportAfter.cashPurchases).toBe(reportBefore.cashPurchases)
  })

  it('treats a stringified "false" as Pay later, not Pay now', async () => {
    const expensesBefore = await purchaseExpenseCount()
    const res = await app.inject({
      method: 'POST',
      url: '/api/inventory',
      headers: auth(admin),
      payload: { name: 'Opening String Test', category: 'Other', unit: 'kg', stock: 1, costPerUnit: 300, paid: 'false', supplier: 'Test Supplier' },
    })
    expect(res.statusCode).toBe(200)
    const { item } = JSON.parse(res.body)
    const purchase = await prisma.stockPurchase.findFirstOrThrow({ where: { inventoryItemId: item.id } })
    expect(purchase.paymentStatus).toBe('unpaid')
    expect(await purchaseExpenseCount()).toBe(expensesBefore)
  })
})
