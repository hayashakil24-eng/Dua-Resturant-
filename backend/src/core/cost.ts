// Ported from frontend/src/utils/cost.js — costing helpers for complimentary
// orders. Cost figures are ESTIMATES seeded from per-category food-cost
// ratios (mockData.js FOOD_COST_RATIO), not measured purchase prices. Every
// surface that renders these numbers must say so.
//
// `formatCostTotal` was NOT ported — it only turns a { costTotal, allKnown }
// result into a display string via a caller-supplied money() formatter, which
// is presentation logic, not business logic; the frontend keeps that
// function and calls it on whatever this module returns.
//
// resolveMenuItem is simpler here than the frontend original: the frontend's
// cart-key parsing ("menuId::variantLabel" string, with a name-regex fallback
// for older lines saved before the variant suffix existed) doesn't apply —
// the backend's OrderItem model already has clean, separate `menuItemId` and
// `variantLabel` columns (see schema.prisma).

import { orderTotal, type OrderTotalItem } from './orderTotal.js'

export interface MenuItemVariantLike {
  label: string
  price: number
  cost: number | null
  costEstimated: boolean
}

export interface MenuItemLike {
  id: string
  cost: number | null
  costEstimated: boolean
  variants?: MenuItemVariantLike[]
}

export interface OrderItemLike extends OrderTotalItem {
  menuItemId: string
  variantLabel?: string | null
  qty: number
  cost?: number | null
  costEstimated?: boolean | null
}

function resolveMenuItem(item: OrderItemLike, menu: MenuItemLike[]): { base?: MenuItemLike; variant?: MenuItemVariantLike | null } {
  const base = menu.find((m) => m.id === item.menuItemId)
  if (!base) return {}
  const variant = item.variantLabel ? base.variants?.find((v) => v.label === item.variantLabel) ?? null : null
  return { base, variant }
}

// Unit cost for one order line. Lines placed after costing was added carry
// their own `cost` snapshot; older/seeded orders don't, so fall back to the
// item's current menu cost. Returns null when the cost is genuinely unknown —
// callers must render that as "—", never as 0, or a giveaway looks free.
export function lineCost(item: OrderItemLike, menu: MenuItemLike[] = []): number | null {
  if (typeof item.cost === 'number') return item.cost
  const { base, variant } = resolveMenuItem(item, menu)
  if (!base) return null
  const cost = variant ? variant.cost : base.cost
  return typeof cost === 'number' ? cost : null
}

// Whether this line's cost is an estimate rather than a measured figure.
export function lineCostEstimated(item: OrderItemLike, menu: MenuItemLike[] = []): boolean {
  if (typeof item.costEstimated === 'boolean') return item.costEstimated
  return Boolean(resolveMenuItem(item, menu).base?.costEstimated)
}

export interface ComplimentaryCostResult {
  billTotal: number
  costTotal: number
  lostMargin: number | null
  allKnown: boolean
  anyEstimated: boolean
}

export interface OrderLike {
  items: OrderItemLike[]
  discountAmount?: number | null
  gstRate?: number | null
}

// Rolls one order up into bill / cost / margin.
//   allKnown  — every line had a cost, so costTotal is complete
//   anyEstimated — at least one line's cost is an estimate
// lostMargin is only meaningful when allKnown; it is null otherwise.
export function complimentaryCost(order: OrderLike, menu: MenuItemLike[] = []): ComplimentaryCostResult {
  const items = order?.items || []
  const billTotal = orderTotal(items, order?.discountAmount ?? 0, order?.gstRate ?? 0).total
  let costTotal = 0
  let allKnown = true
  let anyEstimated = false
  for (const item of items) {
    const c = lineCost(item, menu)
    if (c == null) allKnown = false
    else costTotal += c * item.qty
    if (lineCostEstimated(item, menu)) anyEstimated = true
  }
  return {
    billTotal,
    costTotal,
    lostMargin: allKnown ? billTotal - costTotal : null,
    allKnown,
    anyEstimated,
  }
}
