import { RECIPE_MAP } from '../data/mockData.js'

// 'YYYY-MM-DD' local-day key — matches the Reports page's day bucketing so the
// closing report and the daily report always scope to the same set of orders.
export const toDayStr = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

// Build the end-of-day CLOSING figures for `dateStr`, laid out to match the
// client's cash-handover sheet (CAFÉ ALI daily closing):
//   GROSS SALE → LESS DISCOUNT → NET SALE → {non-cash account channels} →
//   NET CASH SALES → LESS EXPENSES → REMAINING CASH HAND OVER.
// Uses the app's own `orderTotal` (honouring each order's LOCKED gstRate), so the
// numbers match the receipts/daily report. "Accounts" = the non-cash settlement
// channels (each Online payment account by name, plus Card and Udhaar/credit) —
// NET CASH SALES is what's left as physical cash, and the handover is that cash
// minus the day's expenses.
export function buildClosingReport(orders, orderTotal, transactions, dateStr) {
  const dayOrders = orders.filter((o) => toDayStr(o.createdAt) === dateStr)
  const active = dayOrders.filter((o) => !o.cancelled)
  const cancelled = dayOrders.filter((o) => o.cancelled)

  const totalOf = (o) => orderTotal(o.items, o.discount?.amount, o.gstRate)
  const settled = active.filter((o) => o.payment === 'Paid' || o.payment === 'Udhaar')
  const sumBy = (pred) => settled.filter(pred).reduce((s, o) => s + totalOf(o).total, 0)

  const cash = sumBy((o) => o.payment === 'Paid' && o.method === 'Cash')
  const card = sumBy((o) => o.payment === 'Paid' && o.method === 'Card')
  const udhaar = sumBy((o) => o.payment === 'Udhaar')

  const onlineByAccount = Object.entries(
    settled
      .filter((o) => o.payment === 'Paid' && o.method === 'Online')
      .reduce((acc, o) => {
        const k = o.onlineAccountName || 'Online'
        acc[k] = (acc[k] || 0) + totalOf(o).total
        return acc
      }, {}),
  ).sort((a, b) => b[1] - a[1])
  const online = onlineByAccount.reduce((s, [, v]) => s + v, 0)

  // Non-cash "account" channels, in the client's layout (named accounts first).
  const accounts = [
    ...onlineByAccount.map(([name, amount]) => ({ name, amount })),
    ...(card > 0 ? [{ name: 'Card Account', amount: card }] : []),
    ...(udhaar > 0 ? [{ name: 'Udhaar / Credit', amount: udhaar }] : []),
  ]

  const netSale = cash + card + online + udhaar
  const discount = active.reduce((s, o) => s + (o.discount?.amount || 0), 0)
  const grossSale = netSale + discount
  const netCashSales = cash // = NET SALE − accounts (all non-cash channels)

  const expenses = (transactions || [])
    .filter((tx) => tx.type === 'expense' && toDayStr(tx.date) === dateStr)
    .reduce((s, tx) => s + tx.amount, 0)
  const remainingHandover = netCashSales - expenses

  // Extras kept for the on-screen detail / saved record (not on the summary sheet).
  const gstCollected = settled.reduce((s, o) => s + totalOf(o).tax, 0)
  const materialLoss = cancelled.reduce((s, o) => s + (o.materialLoss || 0), 0)
  const invMap = {}
  active.forEach((o) =>
    o.items.forEach((it) => {
      ;(RECIPE_MAP[it.id] || []).forEach((r) => {
        const cur = invMap[r.name] || { qty: 0, unit: r.unit }
        cur.qty += r.qty * it.qty
        invMap[r.name] = cur
      })
    }),
  )
  const inventoryUsed = Object.entries(invMap)
    .map(([name, v]) => ({ name, qty: Math.round(v.qty * 10) / 10, unit: v.unit }))
    .sort((a, b) => b.qty - a.qty)

  return {
    date: dateStr,
    totalOrders: active.length,
    cancelledOrders: cancelled.length,
    grossSale,
    discount,
    netSale,
    accounts,
    cash,
    card,
    online,
    onlineByAccount,
    udhaar,
    netCashSales,
    expenses,
    remainingHandover,
    gstCollected,
    materialLoss,
    inventoryUsed,
  }
}
