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
  // Which named credit account (e.g. "Ali Kakar Account", "Hotel Account") an
  // Udhaar order was booked against — mirrors onlineAccountName. Client's own
  // reference sheets (../../../reports/ in the repo root) always break Udhaar
  // out per named account, never as one lump "Udhaar" total, so this has to
  // be per-order data, same as the online-payment account name already is.
  udhaarCustomerName?: string | null
  // Who a Complimentary order was given to (Order.complimentaryOrderedBy) —
  // the "آفشل بل" / staff-comp report (reports/7.png) lists each free order
  // by recipient name, not by table.
  orderedBy?: string | null
}

export interface ClosingTransaction {
  type: string // 'income' | 'expense'
  amount: number
  date: Date | string
  category?: string | null
  description?: string | null
  // Populated only on Maintenance-category rows — see accounting.service.ts's
  // isMaintenance/MAINTENANCE_CATEGORY. Feeds the itemized Maintenance section
  // below, distinct from the existing per-category expensesByCategory total.
  subCategory?: string | null
  vendor?: string | null
  // Which flow minted this row — 'purchase' (a same-day cash stock buy) vs
  // 'payable_payment' (today settling a supplier credit booked on some
  // EARLIER day) vs anything else (rent, salary, ...). Both purchase types
  // already share one expensesByCategory bucket (PURCHASE_CATEGORY) for the
  // cash-drawer math, which is correct — but distinguishing them here is what
  // lets cashPurchases/supplierPayments below report accurately instead of
  // conflating "bought today" with "paid off an old bill today" (see
  // ../../../CLAUDE.md-adjacent accounting principle: purchase date ≠ payment date).
  source?: string | null
}

// A named credit account — the same shape as Receivable, trimmed to what the
// closing sheet needs. Passed in already filtered to status:'open' by the
// caller (closing.service.ts); filtered again here defensively since the
// frontend mirror (utils/closing.js) passes AppContext's full `receivables`
// array (both open and settled).
export interface ClosingReceivable {
  name: string
  type: string // 'customer' | 'hotel' | 'business'
  balance: number
  status: string
}

// A staff salary advance, pre-joined to the staff member's name/role — the
// closing sheet has no reason to know about Staff beyond display fields.
// Passed in already filtered to status:'pending' by the caller; filtered
// again here for the same reason as ClosingReceivable above.
export interface ClosingAdvance {
  staffName: string
  role: string
  amount: number
  date: Date | string
  deductFromSalaryDate?: Date | string | null
  status: string // 'pending' | 'recovered'
}

// One itemized Maintenance-category expense — the client's Excel ledger
// breaks these out by type (labour/material/rent/fuel/other) and who was
// paid, not just a lump "Maintenance" total.
export interface MaintenanceLine {
  date: string | Date
  subCategory: string | null
  vendor: string | null
  description: string | null
  amount: number
}

// Every session-scoped expense transaction, itemized with its category —
// generalizes MaintenanceLine (which is Maintenance-only, kept as-is since
// other consumers already rely on it) to every category, so a consumer that
// wants an itemized breakdown per category (e.g. the Khulasa summary sheet's
// "Expenses by Type" section — Purchasing items, per-vendor Maintenance rows,
// Daily Wages rows, etc., not just one lump total per category) can group
// this flat list itself instead of the report inventing a per-category shape.
export interface ExpenseTransactionLine {
  date: string | Date
  category: string
  subCategory: string | null
  vendor: string | null
  description: string | null
  amount: number
}

// One open credit account for the Receivables/Udhaar report section — same
// data as an `accounts` line, but this is every OPEN account balance (a
// running position), not today's session activity.
export interface OpenReceivableLine {
  name: string
  type: string
  balance: number
  // The matching open advance for this name, if any (case-insensitive name
  // match) — display-only netting per the client's request to see when
  // someone's advance offsets their dues; no balance/schema change, just
  // shown side by side on the report.
  advanceAgainstDues: number
}

// One pending salary advance for the Advance Salary report section.
export interface OpenAdvanceLine {
  staffName: string
  role: string
  amount: number
  date: string | Date
  deductFromSalaryDate: string | Date | null
  status: string
}

// A stock purchase (paid or credit) — the source of truth for "how much did
// we buy today", separate from ClosingTransaction because a CREDIT purchase
// never creates a Transaction at all (no cash moved yet) — see
// inventory.service.ts's recordPurchase. Cash purchases are counted from
// here too, not from ClosingTransaction{source:'purchase'}, so both figures
// come from one place and can never drift apart.
export interface ClosingPurchase {
  date: Date | string
  totalCost: number
  paymentStatus: string // 'paid' | 'unpaid'
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

// One menu item's sales across the session — qty punched + revenue, same
// shape as the frontend Reports.jsx dashboard's Item-Wise tab (itemMap) and
// Top Selling list (same array, just re-sorted by qty instead of revenue by
// the render layer) — counts every non-cancelled order regardless of
// payment status (Paid/Unpaid/Udhaar/Complimentary), matching `active`
// below and the frontend's own `scopeOrders`, since this is "what did we
// serve", not a revenue-collected figure.
export interface ItemSoldLine {
  name: string
  qty: number
  total: number
}

export interface DiscountBreakdownLine {
  table: number | null
  amount: number
  reason: string
  by: string
}

// One named credit account's ledger for the day (e.g. "Ali Kakar Account"),
// matching the client's own ledger sheets (reports/3.png, reports/5.png):
// a numbered list of that day's Udhaar orders against the account, with a
// running total. "Paid Bill" always starts at 0 / balance = total on a
// freshly-generated closing — a same-day Udhaar sale can't have already been
// paid off within the same session it was booked in; settlement happens
// later, against the Receivable, on a different day.
export interface AccountLedgerLine {
  table: number | null
  amount: number
}

export interface AccountLedger {
  name: string
  lines: AccountLedgerLine[]
  total: number
  paidBill: number
  balance: number
}

// One cancelled order — the "Kainsal Bill" report (reports/4.png) lists every
// cancelled order for the day (table + item description + amount), not just
// a count/loss total. One row per order, not per item — orders are cancelled
// as a whole in this app (Order.cancelled is order-level, not per-line), and
// the client's own sheet groups a multi-item order into one described row.
export interface CancelledOrderLine {
  table: number | null
  description: string
  amount: number
}

// One Complimentary order — the "آفشل بل" (staff/comp bill) report
// (reports/7.png) lists every free order for the day by recipient name +
// item description + the bill amount that was waived.
export interface ComplimentaryOrderLine {
  name: string
  description: string
  amount: number
}

// "1x Chicken Karahi, 2x Garlic Naan" — shared by the Kainsal Bill and Aafshal
// Bill breakdowns, matching how the client's own sheets describe a multi-item
// order as one combined line rather than splitting it into per-item rows.
function describeItems(items: { name: string; qty: number }[]): string {
  return items.map((it) => `${it.qty}x ${it.name}`).join(', ')
}

// core/ never imports from services/ (one-way dependency), so this can't
// import accounting.service.ts's isMaintenance/MAINTENANCE_CATEGORY directly
// — kept in lockstep with it by hand instead.
function isMaintenanceCategory(category: string | null | undefined): boolean {
  return category === 'Cafe Ali Maintenance' || category === 'Maintenance'
}

export interface ClosingReport {
  date: string
  // The recording window this report actually covers. `date` is only a label —
  // a session routinely spans two calendar days (open 2pm, close 3pm the next
  // day), so these are what any header/print surface should show. periodStart
  // is the previous closing's time (null before the first-ever closing, where
  // scoping falls back to the calendar day); periodEnd is null while the
  // session is still open and gets stamped at save time.
  periodStart: string | null
  periodEnd: string | null
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
  udhaarByAccount: [string, number][]
  accountLedgers: AccountLedger[]
  netCashSales: number
  expenses: number
  expensesByCategory: ExpenseCategoryLine[]
  expenseTransactions: ExpenseTransactionLine[]
  remainingHandover: number
  gstCollected: number
  materialLoss: number
  inventoryUsed: InventoryUsedLine[]
  cancelledItems: CancelledOrderLine[]
  cancelledTotal: number
  complimentaryItems: ComplimentaryOrderLine[]
  complimentaryTotal: number
  itemsSold: ItemSoldLine[]
  // Today's stock buying, split by how it was paid — see the accounting
  // principle in ../../../CLAUDE.md-adjacent notes: a credit purchase must
  // never reduce cash, and paying off an OLD credit purchase today must never
  // be reported as a new purchase. cashPurchases + creditPurchases already
  // both count toward `expenses`/expensesByCategory when cash purchases are
  // involved (unchanged) — these are the same money, just broken out for
  // legibility, not additional spend.
  cashPurchases: number
  creditPurchases: number
  totalPurchases: number
  // Today's payments against a supplier credit opened on some earlier day
  // (payables.service.ts's recordPayablePayment) — real cash out today, but
  // NOT a new purchase; kept out of cashPurchases/totalPurchases above for
  // exactly that reason, even though it's already folded into `expenses`.
  supplierPayments: number
  // Itemized Maintenance-category expenses for this session (already inside
  // `expenses`/`expensesByCategory` — this is a breakdown, not additional
  // spend), plus a subtotal matching the category's own bucket.
  maintenanceItems: MaintenanceLine[]
  maintenanceTotal: number
  // Live snapshot of every open credit account (not session-scoped — a
  // running balance, not a day event), plus the grand total the client's own
  // ledger always shows as the sum of every named account.
  openReceivables: OpenReceivableLine[]
  receivablesTotal: number
  // Live snapshot of every pending salary advance (not session-scoped).
  openAdvances: OpenAdvanceLine[]
  advancesTotal: number
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
  purchases: ClosingPurchase[] = [],
  receivables: ClosingReceivable[] = [],
  advances: ClosingAdvance[] = [],
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

  // Udhaar broken down by the named credit account it was booked against
  // (e.g. "Ali Kakar Account", "Hotel Account") — the client's own sheets
  // never show one lump "Udhaar" total, always a line per named account
  // (reports/2.png, reports/6.png). Falls back to a generic label only for
  // orders that predate udhaarCustomerName being captured.
  const udhaarOrders = settled.filter((o) => o.payment === 'Udhaar')
  const udhaarByAccount = Object.entries(
    udhaarOrders.reduce<Record<string, number>>((acc, o) => {
      const k = o.udhaarCustomerName || 'Udhaar / Credit'
      acc[k] = (acc[k] || 0) + totalOf(o).total
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])

  // Non-cash "account" channels, in the client's layout (named accounts first).
  const accounts: ClosingAccount[] = [
    ...onlineByAccount.map(([name, amount]) => ({ name, amount })),
    ...(card > 0 ? [{ name: 'Card Account', amount: card }] : []),
    ...udhaarByAccount.map(([name, amount]) => ({ name, amount })),
  ]

  // Per-account ledgers (reports/3.png, reports/5.png) — a numbered list of
  // that day's Udhaar orders per named account, backing the account line in
  // `accounts` above with the same per-order detail the Discount/Expense
  // breakdowns already get.
  const accountLedgers: AccountLedger[] = udhaarByAccount.map(([name, total]) => ({
    name,
    lines: udhaarOrders
      .filter((o) => (o.udhaarCustomerName || 'Udhaar / Credit') === name)
      .map((o) => ({ table: o.table ?? null, amount: totalOf(o).total })),
    total,
    paidBill: 0,
    balance: total,
  }))

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

  // Every session expense, itemized — see ExpenseTransactionLine's doc comment.
  const expenseTransactions: ExpenseTransactionLine[] = dayExpenses
    .map((tx) => ({
      date: tx.date,
      category: tx.category || 'Other',
      subCategory: tx.subCategory ?? null,
      vendor: tx.vendor ?? null,
      description: tx.description ?? null,
      amount: tx.amount,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || +new Date(b.date) - +new Date(a.date))

  // Itemized Maintenance-category expenses this session — a breakdown of the
  // "Cafe Ali Maintenance" bucket already inside expensesByCategory above,
  // not additional spend.
  const maintenanceItems: MaintenanceLine[] = dayExpenses
    .filter((tx) => isMaintenanceCategory(tx.category))
    .map((tx) => ({
      date: tx.date,
      subCategory: tx.subCategory ?? null,
      vendor: tx.vendor ?? null,
      description: tx.description ?? null,
      amount: tx.amount,
    }))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
  const maintenanceTotal = maintenanceItems.reduce((s, m) => s + m.amount, 0)

  // Live snapshot of every open credit account — a running position, not
  // scoped to this session — matching the client's own ledger, which always
  // shows the grand total as the sum of every named account.
  const openReceivablesRaw = receivables.filter((r) => r.status === 'open')
  const openAdvancesRaw = advances.filter((a) => a.status === 'pending')
  const openReceivables: OpenReceivableLine[] = openReceivablesRaw
    .map((r) => {
      const advance = openAdvancesRaw.find((a) => a.staffName.trim().toLowerCase() === r.name.trim().toLowerCase())
      return { name: r.name, type: r.type, balance: r.balance, advanceAgainstDues: advance?.amount ?? 0 }
    })
    .sort((a, b) => b.balance - a.balance)
  const receivablesTotal = openReceivables.reduce((s, r) => s + r.balance, 0)

  const openAdvances: OpenAdvanceLine[] = openAdvancesRaw
    .map((a) => ({
      staffName: a.staffName,
      role: a.role,
      amount: a.amount,
      date: a.date,
      deductFromSalaryDate: a.deductFromSalaryDate ?? null,
      status: a.status,
    }))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
  const advancesTotal = openAdvances.reduce((s, a) => s + a.amount, 0)

  // Purchases today, split by payment type — from StockPurchase rows
  // directly (not derived from `transactions`), since a credit purchase never
  // creates a Transaction at all (see ClosingPurchase's doc comment above).
  const dayPurchases = purchases.filter((p) => inSession(p.date))
  const cashPurchases = dayPurchases.filter((p) => p.paymentStatus === 'paid').reduce((s, p) => s + p.totalCost, 0)
  const creditPurchases = dayPurchases.filter((p) => p.paymentStatus !== 'paid').reduce((s, p) => s + p.totalCost, 0)
  const totalPurchases = cashPurchases + creditPurchases
  // Today's cash paid AGAINST an old credit purchase — already inside
  // `expenses` above (real cash out today), reported separately here so it
  // never gets read as "today's purchases" (that figure is totalPurchases).
  const supplierPayments = dayExpenses.filter((tx) => tx.source === 'payable_payment').reduce((s, tx) => s + tx.amount, 0)

  // Extras kept for the on-screen detail / saved record (not on the summary sheet).
  const gstCollected = settled.reduce((s, o) => s + totalOf(o).tax, 0)
  const materialLoss = cancelled.reduce((s, o) => s + (o.materialLoss || 0), 0)
  // "Kainsal Bill" — every cancelled order, itemized (reports/4.png), not
  // just the count/materialLoss totals already tracked above.
  const cancelledItems: CancelledOrderLine[] = cancelled
    .map((o) => ({ table: o.table ?? null, description: describeItems(o.items), amount: totalOf(o).total }))
    .sort((a, b) => b.amount - a.amount)
  const cancelledTotal = cancelledItems.reduce((s, i) => s + i.amount, 0)

  // "آفشل بل" (Aafshal / staff-comp bill) — every Complimentary order,
  // itemized by recipient (reports/7.png). Complimentary orders are excluded
  // from `settled`/sales entirely (the bill was waived, not paid), so this is
  // the only place their amount is reported at all.
  const complimentary = active.filter((o) => o.payment === 'Complimentary')
  const complimentaryItems: ComplimentaryOrderLine[] = complimentary
    .map((o) => ({ name: o.orderedBy || '—', description: describeItems(o.items), amount: totalOf(o).total }))
    .sort((a, b) => b.amount - a.amount)
  const complimentaryTotal = complimentaryItems.reduce((s, i) => s + i.amount, 0)
  // Approved-recipe deductions across the day's items — same source as live
  // inventory deduction (inventoryFlow.ts), not a separate hand-maintained map.
  const deductions = calculateDeductions(active.flatMap((o) => o.items), inventory, recipes)
  const inventoryUsed: InventoryUsedLine[] = Object.values(deductions)
    .map((d) => ({ name: d.itemName, qty: Math.round(d.amount * 10) / 10, unit: d.unit }))
    .sort((a, b) => b.qty - a.qty)

  // Item-wise sales — every line across every non-cancelled order this
  // session, aggregated by menu item name. Mirrors the frontend Reports.jsx
  // dashboard's Item-Wise tab exactly (same `active`/qty*price shape); the
  // WhatsApp render layer re-sorts a copy of this same array by qty for its
  // own Top Selling block instead of computing a second aggregate.
  const itemSales = new Map<string, { qty: number; total: number }>()
  for (const o of active) {
    for (const it of o.items) {
      const cur = itemSales.get(it.name) ?? { qty: 0, total: 0 }
      cur.qty += it.qty
      // Rounded per line — qty can be a decimal kg weight now, and every
      // money figure shown/saved must stay a whole rupee.
      cur.total += Math.round(it.price * it.qty)
      itemSales.set(it.name, cur)
    }
  }
  const itemsSold: ItemSoldLine[] = Array.from(itemSales, ([name, v]) => ({ name, ...v })).sort(
    (a, b) => b.total - a.total,
  )

  return {
    date: dateStr,
    periodStart: sinceIso,
    periodEnd: null, // stamped with closingTime when the session is saved
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
    udhaarByAccount,
    accountLedgers,
    netCashSales,
    expenses,
    expensesByCategory,
    expenseTransactions,
    remainingHandover,
    gstCollected,
    materialLoss,
    inventoryUsed,
    cancelledItems,
    cancelledTotal,
    complimentaryItems,
    complimentaryTotal,
    itemsSold,
    cashPurchases,
    creditPurchases,
    totalPurchases,
    supplierPayments,
    maintenanceItems,
    maintenanceTotal,
    openReceivables,
    receivablesTotal,
    openAdvances,
    advancesTotal,
  }
}
