// Ported from frontend/src/utils/closing.js (already updated in a prior
// frontend bug-fix pass to source "inventory used" from real approved-recipe
// deductions instead of a stale, hand-maintained RECIPE_MAP — this port
// carries that fix forward, not the original buggy version).
//
// Adaptation: the frontend takes `orderTotal` as an injected parameter
// (AppContext's closure-scoped version, which can default the GST rate from
// live app settings). The backend has no such closure — it imports
// orderTotal.ts directly and every order here always carries its own locked
// `gstRate`, so there's nothing to inject.

import { orderTotal, type OrderTotalItem } from './orderTotal.js'
import { calculateDeductions, type InventoryItemLike, type RecipeLike, type OrderItemLike as DeductionOrderItem } from './inventoryFlow.js'

export interface ClosingOrderItem extends OrderTotalItem, DeductionOrderItem {
  name: string
}

export interface ClosingOrder {
  createdAt: Date | string
  cancelled: boolean
  payment: string // 'Unpaid' | 'Paid' | 'Udhaar' | 'Complimentary'
  method: string
  items: ClosingOrderItem[]
  discountAmount?: number | null
  gstRate: number
  onlineAccountName?: string | null
  materialLoss?: number | null
  // Client feedback on the WhatsApp report (client-reply-on-whatsapp-report.ogg):
  // wants a per-order breakdown of the Discount line, same treatment Accounts
  // and Expenses already get — which table, how much, why, who authorized it.
  table?: number | null
  discountReason?: string | null
  discountBy?: string | null
}

export interface ClosingTransaction {
  type: string // 'income' | 'expense'
  amount: number
  date: Date | string
  category?: string | null
}

export interface ClosingAccount {
  name: string
  amount: number
}

export interface ExpenseCategoryLine {
  category: string
  amount: number
}

export interface InventoryUsedLine {
  name: string
  qty: number
  unit: string
}

export interface DiscountBreakdownLine {
  table: number | null
  amount: number
  reason: string
  by: string
}

export interface ClosingReport {
  date: string
  totalOrders: number
  cancelledOrders: number
  grossSale: number
  discount: number
  discountBreakdown: DiscountBreakdownLine[]
  netSale: number
  accounts: ClosingAccount[]
  cash: number
  card: number
  online: number
  onlineByAccount: [string, number][]
  udhaar: number
  netCashSales: number
  expenses: number
  expensesByCategory: ExpenseCategoryLine[]
  remainingHandover: number
  gstCollected: number
  materialLoss: number
  inventoryUsed: InventoryUsedLine[]
}

// 'YYYY-MM-DD' local-day key — matches the Reports page's day bucketing so the
// closing report and the daily report always scope to the same set of orders.
export function toDayStr(d: Date | string): string {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

// Build the end-of-day CLOSING figures for `dateStr`, laid out to match the
// client's cash-handover sheet (CAFÉ ALI daily closing):
//   GROSS SALE → LESS DISCOUNT → NET SALE → {non-cash account channels} →
//   NET CASH SALES → LESS EXPENSES → REMAINING CASH HAND OVER.
// "Accounts" = the non-cash settlement channels (each Online payment account
// by name, plus Card and Udhaar/credit) — NET CASH SALES is what's left as
// physical cash, and the handover is that cash minus the day's expenses.
export function buildClosingReport(
  orders: ClosingOrder[],
  transactions: ClosingTransaction[],
  dateStr: string,
  inventory: InventoryItemLike[] = [],
  recipes: RecipeLike[] = [],
  // Business-day "session" boundary: when set, the report covers everything
  // created AFTER the last closing instead of the whole calendar day, so a
  // second closing the same day only reports that session and the live figures
  // reset the moment a day is closed (demand.md #9). Null = legacy whole-day.
  sinceIso: string | null = null,
): ClosingReport {
  const sinceMs = sinceIso ? new Date(sinceIso).getTime() : null
  const inSession = (d: Date | string) =>
    sinceMs !== null ? new Date(d).getTime() > sinceMs : toDayStr(d) === dateStr
  const dayOrders = orders.filter((o) => inSession(o.createdAt))
  const active = dayOrders.filter((o) => !o.cancelled)
  const cancelled = dayOrders.filter((o) => o.cancelled)

  const totalOf = (o: ClosingOrder) => orderTotal(o.items, o.discountAmount ?? 0, o.gstRate)
  const settled = active.filter((o) => o.payment === 'Paid' || o.payment === 'Udhaar')
  const sumBy = (pred: (o: ClosingOrder) => boolean) => settled.filter(pred).reduce((s, o) => s + totalOf(o).total, 0)

  const cash = sumBy((o) => o.payment === 'Paid' && o.method === 'Cash')
  const card = sumBy((o) => o.payment === 'Paid' && o.method === 'Card')
  const udhaar = sumBy((o) => o.payment === 'Udhaar')

  const onlineByAccount = Object.entries(
    settled
      .filter((o) => o.payment === 'Paid' && o.method === 'Online')
      .reduce<Record<string, number>>((acc, o) => {
        const k = o.onlineAccountName || 'Online'
        acc[k] = (acc[k] || 0) + totalOf(o).total
        return acc
      }, {}),
  ).sort((a, b) => b[1] - a[1])
  const online = onlineByAccount.reduce((s, [, v]) => s + v, 0)

  // Non-cash "account" channels, in the client's layout (named accounts first).
  const accounts: ClosingAccount[] = [
    ...onlineByAccount.map(([name, amount]) => ({ name, amount })),
    ...(card > 0 ? [{ name: 'Card Account', amount: card }] : []),
    ...(udhaar > 0 ? [{ name: 'Udhaar / Credit', amount: udhaar }] : []),
  ]

  const netSale = cash + card + online + udhaar
  const discount = active.reduce((s, o) => s + (o.discountAmount || 0), 0)
  // Client feedback on the WhatsApp report: wants to see which orders a
  // discount applied to, not just the total — same per-line treatment as
  // Accounts and Expenses already get.
  const discountBreakdown: DiscountBreakdownLine[] = active
    .filter((o) => (o.discountAmount || 0) > 0)
    .map((o) => ({ table: o.table ?? null, amount: o.discountAmount || 0, reason: o.discountReason || '', by: o.discountBy || '' }))
    .sort((a, b) => b.amount - a.amount)
  const grossSale = netSale + discount
  const netCashSales = cash // = NET SALE − accounts (all non-cash channels)

  const dayExpenses = (transactions || []).filter((tx) => tx.type === 'expense' && inSession(tx.date))
  const expenses = dayExpenses.reduce((s, tx) => s + tx.amount, 0)
  // Per-category breakdown (e.g. Maintenance/Construction) — same grouping as
  // the frontend's Accounting.jsx ExpenseBreakdown, scoped to this one day.
  const expensesByCategory: ExpenseCategoryLine[] = Object.entries(
    dayExpenses.reduce<Record<string, number>>((acc, tx) => {
      const cat = tx.category || 'Other'
      acc[cat] = (acc[cat] || 0) + tx.amount
      return acc
    }, {}),
  )
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
  const remainingHandover = netCashSales - expenses

  // Extras kept for the on-screen detail / saved record (not on the summary sheet).
  const gstCollected = settled.reduce((s, o) => s + totalOf(o).tax, 0)
  const materialLoss = cancelled.reduce((s, o) => s + (o.materialLoss || 0), 0)
  // Approved-recipe deductions across the day's items — same source as live
  // inventory deduction (inventoryFlow.ts), not a separate hand-maintained map.
  const deductions = calculateDeductions(active.flatMap((o) => o.items), inventory, recipes)
  const inventoryUsed: InventoryUsedLine[] = Object.values(deductions)
    .map((d) => ({ name: d.itemName, qty: Math.round(d.amount * 10) / 10, unit: d.unit }))
    .sort((a, b) => b.qty - a.qty)

  return {
    date: dateStr,
    totalOrders: active.length,
    cancelledOrders: cancelled.length,
    grossSale,
    discount,
    discountBreakdown,
    netSale,
    accounts,
    cash,
    card,
    online,
    onlineByAccount,
    udhaar,
    netCashSales,
    expenses,
    expensesByCategory,
    remainingHandover,
    gstCollected,
    materialLoss,
    inventoryUsed,
  }
}
