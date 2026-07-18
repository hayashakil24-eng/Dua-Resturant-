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
}

export interface OrderTotalResult {
  subtotal: number
  tax: number
  discount: number
  total: number
}

export function orderTotal(items: OrderTotalItem[], discount = 0, rate = 0): OrderTotalResult {
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0)
  const tax = Math.round(subtotal * rate)
  const gross = subtotal + tax
  const discountAmt = Math.min(Math.max(0, Number(discount) || 0), gross)
  return { subtotal, tax, discount: discountAmt, total: gross - discountAmt }
}
