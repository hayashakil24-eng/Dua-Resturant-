import { describe, expect, it } from 'vitest'
import { buildClosingReport, toDayStr, type ClosingOrder, type ClosingTransaction } from '../src/core/closing.js'
import type { InventoryItemLike, RecipeLike } from '../src/core/inventoryFlow.js'

const dateStr = '2026-07-18'
const todayAt = (h: number, m: number) => new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)

// Same ckh1 fixture as inventoryFlow.test.ts / prisma/seed.ts.
const inventory: InventoryItemLike[] = [
  { id: 'INV02', unit: 'L', stock: 10, threshold: 8, costPerUnit: 550 },
  { id: 'INV03', unit: 'kg', stock: 10, threshold: 12, costPerUnit: 550 },
]
const recipes: RecipeLike[] = [
  {
    menuItemId: 'ckh1',
    status: 'approved',
    ingredients: [
      { inventoryItemId: 'INV03', itemName: 'Chicken', quantity: 0.5, unit: 'kg' },
      { inventoryItemId: 'INV02', itemName: 'Cooking Oil', quantity: 0.1, unit: 'L' },
    ],
  },
]

const orders: ClosingOrder[] = [
  {
    createdAt: todayAt(11, 10),
    cancelled: false,
    payment: 'Paid',
    method: 'Cash',
    gstRate: 0,
    items: [{ menuItemId: 'ckh1', name: 'Chicken Shahi Karahi', price: 2699, qty: 2 }],
  },
  {
    createdAt: todayAt(12, 0),
    cancelled: false,
    payment: 'Paid',
    method: 'Card',
    gstRate: 0,
    items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 3 }],
  },
  {
    // Cancelled — excluded from sales, but its materialLoss still counts.
    createdAt: todayAt(13, 0),
    cancelled: true,
    payment: 'Unpaid',
    method: '—',
    gstRate: 0,
    materialLoss: 660,
    items: [{ menuItemId: 'ckh1', name: 'Chicken Shahi Karahi', price: 2699, qty: 2 }],
  },
  {
    // Different day — must be excluded entirely.
    createdAt: new Date('2026-07-17T11:00:00'),
    cancelled: false,
    payment: 'Paid',
    method: 'Cash',
    gstRate: 0,
    items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 100 }],
  },
]

const transactions: ClosingTransaction[] = [
  { type: 'expense', amount: 500, date: todayAt(9, 0), category: 'Maintenance' },
]

describe('toDayStr', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toDayStr(todayAt(15, 30))).toBe('2026-07-18')
  })
})

describe('buildClosingReport', () => {
  it('computes gross/net/cash/card correctly and scopes strictly to the given day', () => {
    const report = buildClosingReport(orders, transactions, dateStr, inventory, recipes)

    expect(report.totalOrders).toBe(2) // the two active same-day orders, not the other-day one
    expect(report.cancelledOrders).toBe(1)
    expect(report.cash).toBe(5398) // 2699 * 2
    expect(report.card).toBe(450) // 150 * 3
    expect(report.netSale).toBe(5848)
    expect(report.grossSale).toBe(5848) // no discounts in this fixture
    expect(report.netCashSales).toBe(5398) // cash only, not cash+card
  })

  it('subtracts same-day expenses for the handover figure', () => {
    const report = buildClosingReport(orders, transactions, dateStr, inventory, recipes)
    expect(report.expenses).toBe(500)
    expect(report.remainingHandover).toBe(5398 - 500)
  })

  it('groups same-day expenses by category (e.g. Maintenance)', () => {
    const report = buildClosingReport(orders, transactions, dateStr, inventory, recipes)
    expect(report.expensesByCategory).toEqual([{ category: 'Maintenance', amount: 500 }])
  })

  it('carries the cancelled order\'s materialLoss even though it\'s excluded from sales', () => {
    const report = buildClosingReport(orders, transactions, dateStr, inventory, recipes)
    expect(report.materialLoss).toBe(660)
  })

  it('derives inventoryUsed from real approved-recipe deductions on active orders only (the RECIPE_MAP bug this port carries the fix for)', () => {
    const report = buildClosingReport(orders, transactions, dateStr, inventory, recipes)
    const chicken = report.inventoryUsed.find((i) => i.name === 'Chicken')
    const oil = report.inventoryUsed.find((i) => i.name === 'Cooking Oil')
    expect(chicken).toEqual({ name: 'Chicken', qty: 1, unit: 'kg' })
    expect(oil).toEqual({ name: 'Cooking Oil', qty: 0.2, unit: 'L' })
    // br2 (Garlic Naan) has no recipe, so it contributes nothing — only 2 lines total.
    expect(report.inventoryUsed).toHaveLength(2)
  })
})
