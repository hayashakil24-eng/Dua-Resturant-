// Ported from the `orderTotal` function defined inline in
// frontend/src/context/AppContext.jsx (not a separate utils/*.js file, but
// pulled out here because utils/cost.js and utils/closing.js both take it as
// a parameter — the backend needs the same function to port those).
//
// One behavioral adaptation: the frontend defaults `rate` to the live
// `gstEnabled ? gstRate : 0` app-wide settings when the caller omits it (used
// for an in-progress POS cart that hasn't locked a rate yet). The backend has
// no such implicit global-settings closure, so `rate` is required here —
// every real call site in closing.ts/cost.ts already always passes the
// order's own locked `gstRate` explicitly, so this isn't a behavior change
// for any ported caller, only for the frontend's live-cart preview case,
// which stays a frontend-only concern.

export interface OrderTotalItem {
  price: number
  qty: number
  // Item-wise cancellation (a single line voided off an otherwise-running
  // bill, distinct from the whole order's own `cancelled`) — excluded from
  // every money total here so a cancelled item's price never survives into
  // the bill, but callers still keep it in their own `items` array for
  // display (struck through) since it's never removed from the order.
  cancelled?: boolean
}

export interface OrderTotalResult {
  subtotal: number
  tax: number
  discount: number
  total: number
}

export function orderTotal(items: OrderTotalItem[], discount = 0, rate = 0): OrderTotalResult {
  // Rounded per line, not just at the end — qty can be a decimal weight now
  // (kg-billed items), and every money figure shown anywhere must stay a
  // whole rupee, matching each line's own displayed amount.
  const subtotal = items.filter((it) => !it.cancelled).reduce((s, it) => s + Math.round(it.price * it.qty), 0)
  const tax = Math.round(subtotal * rate)
  const gross = subtotal + tax
  const discountAmt = Math.min(Math.max(0, Number(discount) || 0), gross)
  return { subtotal, tax, discount: discountAmt, total: gross - discountAmt }
}
