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

// Business-day "session" boundary (demand.md #9): with a `sinceIso` the report
// covers only what was created AFTER the last closing, so a second closing the
// same day reports just that session and the live figures reset on close.
describe('buildClosingReport session boundary', () => {
  it('counts only orders/expenses created after the boundary', () => {
    const since = todayAt(11, 30).toISOString() // between the 11:10 and 12:00 orders
    const report = buildClosingReport(orders, transactions, dateStr, inventory, recipes, since)
    expect(report.totalOrders).toBe(1) // only the 12:00 card order
    expect(report.cash).toBe(0) // 11:10 cash order is before the boundary
    expect(report.card).toBe(450)
    expect(report.netSale).toBe(450)
    expect(report.expenses).toBe(0) // 09:00 expense is before the boundary
  })

  it('reports an empty session when the boundary is after all activity', () => {
    const since = todayAt(23, 0).toISOString()
    const report = buildClosingReport(orders, transactions, dateStr, inventory, recipes, since)
    expect(report.totalOrders).toBe(0)
    expect(report.netSale).toBe(0)
    expect(report.expenses).toBe(0)
  })
})

// Client's own reference sheets (reports/2.png, reports/3.png, reports/5.png,
// reports/6.png in the repo root) always break Udhaar out per named credit
// account ("Ali Kakar Account", "Hotel Account"), never as one lump "Udhaar"
// total — and back each account line with a numbered per-order ledger.
describe('buildClosingReport Udhaar account breakdown', () => {
  const udhaarOrders: ClosingOrder[] = [
    {
      createdAt: todayAt(14, 0),
      cancelled: false,
      payment: 'Udhaar',
      method: 'Udhaar',
      gstRate: 0,
      table: 8,
      udhaarCustomerName: 'Ali Kakar Account',
      items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 4 }], // 600
    },
    {
      // Second order against the SAME account — ledger sums both into one total.
      createdAt: todayAt(14, 30),
      cancelled: false,
      payment: 'Udhaar',
      method: 'Udhaar',
      gstRate: 0,
      table: 3,
      udhaarCustomerName: 'Ali Kakar Account',
      items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 2 }], // 300
    },
    {
      // Different named account — its own separate line/ledger.
      createdAt: todayAt(15, 0),
      cancelled: false,
      payment: 'Udhaar',
      method: 'Udhaar',
      gstRate: 0,
      table: 12,
      udhaarCustomerName: 'Hotel Account',
      items: [{ menuItemId: 'ckh1', name: 'Chicken Shahi Karahi', price: 2699, qty: 1 }], // 2699
    },
    {
      // No udhaarCustomerName (predates the field) — falls back to a generic label.
      createdAt: todayAt(15, 30),
      cancelled: false,
      payment: 'Udhaar',
      method: 'Udhaar',
      gstRate: 0,
      table: 5,
      items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 1 }], // 150
    },
  ]

  it('sums Udhaar per named account instead of one lump total', () => {
    const report = buildClosingReport(udhaarOrders, [], dateStr, [], [])
    expect(report.udhaar).toBe(600 + 300 + 2699 + 150)
    expect(report.udhaarByAccount).toEqual([
      ['Hotel Account', 2699],
      ['Ali Kakar Account', 900],
      ['Udhaar / Credit', 150],
    ])
  })

  it('lists each named account as its own line in `accounts`', () => {
    const report = buildClosingReport(udhaarOrders, [], dateStr, [], [])
    expect(report.accounts).toEqual([
      { name: 'Hotel Account', amount: 2699 },
      { name: 'Ali Kakar Account', amount: 900 },
      { name: 'Udhaar / Credit', amount: 150 },
    ])
  })

  it('builds a numbered per-order ledger per account, with balance = total (nothing paid yet)', () => {
    const report = buildClosingReport(udhaarOrders, [], dateStr, [], [])
    const aliKakar = report.accountLedgers.find((l) => l.name === 'Ali Kakar Account')
    expect(aliKakar).toEqual({
      name: 'Ali Kakar Account',
      lines: [
        { table: 8, amount: 600 },
        { table: 3, amount: 300 },
      ],
      total: 900,
      paidBill: 0,
      balance: 900,
    })
    const hotel = report.accountLedgers.find((l) => l.name === 'Hotel Account')
    expect(hotel).toEqual({
      name: 'Hotel Account',
      lines: [{ table: 12, amount: 2699 }],
      total: 2699,
      paidBill: 0,
      balance: 2699,
    })
  })
})

// "Kainsal Bill" (reports/4.png) — every cancelled order, itemized as one row
// per order (this app cancels a whole order, not individual lines within
// one), not just the count/materialLoss totals the summary already shows.
describe('buildClosingReport cancelled items ("Kainsal Bill")', () => {
  const cancelledOrders: ClosingOrder[] = [
    {
      createdAt: todayAt(13, 0),
      cancelled: true,
      payment: 'Unpaid',
      method: '—',
      gstRate: 0,
      table: 8,
      materialLoss: 660,
      items: [{ menuItemId: 'ckh1', name: 'Chicken Shahi Karahi', price: 2699, qty: 2 }], // 5398
    },
    {
      // Multi-item order — must be combined into ONE described row, not split.
      createdAt: todayAt(13, 30),
      cancelled: true,
      payment: 'Unpaid',
      method: '—',
      gstRate: 0,
      table: 3,
      items: [
        { menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 2 }, // 300
        { menuItemId: 'wtr1', name: 'Water Bottle', price: 100, qty: 1 }, // 100
      ],
    },
    {
      // Active order — must not leak into the cancelled-items report.
      createdAt: todayAt(11, 10),
      cancelled: false,
      payment: 'Paid',
      method: 'Cash',
      gstRate: 0,
      items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 1 }],
    },
  ]

  it('lists each cancelled order as one row, sorted by amount, excluding active orders', () => {
    const report = buildClosingReport(cancelledOrders, [], dateStr, [], [])
    expect(report.cancelledItems).toEqual([
      { table: 8, description: '2x Chicken Shahi Karahi', amount: 5398 },
      { table: 3, description: '2x Garlic Naan, 1x Water Bottle', amount: 400 },
    ])
    expect(report.cancelledTotal).toBe(5398 + 400)
  })
})

// "آفشل بل" (reports/7.png) — every Complimentary order, itemized by
// recipient name (not table), same one-row-per-order treatment as the
// Kainsal Bill above.
describe('buildClosingReport complimentary items ("Aafshal Bill")', () => {
  const complimentaryOrders: ClosingOrder[] = [
    {
      createdAt: todayAt(16, 0),
      cancelled: false,
      payment: 'Complimentary',
      method: 'Free',
      gstRate: 0,
      orderedBy: 'Zaman',
      items: [{ menuItemId: 'tea1', name: 'Tea', price: 250, qty: 2 }], // 500
    },
    {
      createdAt: todayAt(16, 30),
      cancelled: false,
      payment: 'Complimentary',
      method: 'Free',
      gstRate: 0,
      orderedBy: 'Saif Baloch',
      items: [
        { menuItemId: 'wtr1', name: 'Water', price: 160, qty: 1 }, // 160
        { menuItemId: 'tea1', name: 'Tea', price: 250, qty: 6 }, // 1500
      ], // 1660
    },
    {
      // A regular paid order must not leak into the complimentary report,
      // and must still be counted as a normal sale.
      createdAt: todayAt(11, 10),
      cancelled: false,
      payment: 'Paid',
      method: 'Cash',
      gstRate: 0,
      items: [{ menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 1 }],
    },
  ]

  it('lists each complimentary order by recipient, sorted by amount', () => {
    const report = buildClosingReport(complimentaryOrders, [], dateStr, [], [])
    expect(report.complimentaryItems).toEqual([
      { name: 'Saif Baloch', description: '1x Water, 6x Tea', amount: 1660 },
      { name: 'Zaman', description: '2x Tea', amount: 500 },
    ])
    expect(report.complimentaryTotal).toBe(1660 + 500)
  })

  it('does not count complimentary orders as sales (bill was waived, not paid)', () => {
    const report = buildClosingReport(complimentaryOrders, [], dateStr, [], [])
    expect(report.netSale).toBe(150) // only the one Paid/Cash order
    expect(report.totalOrders).toBe(3) // still counted as an order (active, not cancelled)
  })
})
