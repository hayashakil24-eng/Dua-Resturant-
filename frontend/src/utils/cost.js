// Costing helpers for complimentary orders.
//
// Cost figures are currently ESTIMATES seeded from per-category food-cost
// ratios (see FOOD_COST_RATIO in data/mockData.js), not measured purchase
// prices. Every surface that renders these numbers must say so.

// Unit cost for one order line. Lines placed after costing was added carry
// their own `cost` snapshot; older/seeded orders don't, so fall back to the
// item's current menu cost. Returns null when the cost is genuinely unknown —
// callers must render that as "—", never as 0, or a giveaway looks free.
// An order line's `id` is the POS cart key, which for a variant item is
// "menuId::Label" (e.g. "pz1::Large") rather than a plain menu id — so split
// before looking the item up, or every variant line misses the menu entirely.
function resolveMenuItem(item, menu) {
  const [baseId, variantLabel] = String(item?.id ?? '').split('::')
  const base = menu.find((m) => m.id === baseId)
  if (!base) return {}
  // Fall back to the "Name (Label)" the POS renders for older lines whose id
  // was stored without the variant suffix.
  const label = variantLabel || item.name?.match(/\(([^)]+)\)\s*$/)?.[1]
  const variant = label ? base.variants?.find((v) => v.label === label) : null
  return { base, variant }
}

export function lineCost(item, menu = []) {
  if (typeof item.cost === 'number') return item.cost
  const { base, variant } = resolveMenuItem(item, menu)
  if (!base) return null
  const cost = variant ? variant.cost : base.cost
  return typeof cost === 'number' ? cost : null
}

// Whether this line's cost is an estimate rather than a measured figure.
export function lineCostEstimated(item, menu = []) {
  if (typeof item.costEstimated === 'boolean') return item.costEstimated
  return Boolean(resolveMenuItem(item, menu).base?.costEstimated)
}

// Renders a cost roll-up for display. Never prints a bare "Rs. 0" for an
// unknown cost — zero-because-we-don't-know reads as "this was free", which is
// the opposite of the truth. Falls back to "Unknown", or "Rs. N+" when we know
// part of the total (some lines costed, others not).
export function formatCostTotal({ costTotal, allKnown }, money) {
  if (allKnown) return money(costTotal)
  return costTotal > 0 ? `${money(costTotal)}+` : 'Unknown'
}

// Rolls one order up into bill / cost / margin.
//   allKnown  — every line had a cost, so costTotal is complete
//   anyEstimated — at least one line's cost is an estimate
// lostMargin is only meaningful when allKnown; it is null otherwise.
//
// Pass the app's `orderTotal` so the bill figure matches what the receipt
// prints (tax/discount included); without it this falls back to a raw line sum.
export function complimentaryCost(order, menu = [], orderTotal) {
  const items = order?.items || []
  const billTotal = orderTotal
    ? orderTotal(items, order?.discount?.amount, order?.gstRate).total
    : items.reduce((s, i) => s + i.price * i.qty, 0)
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
