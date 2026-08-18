// Groups an order's items by department (kitchen counter) — shared between
// KitchenSlips.jsx (the HTML/CSS docket, used as the browser-dev-mode
// fallback — see print.js's printKotRaw) and escpos.js's buildKotEscPos (the
// raw ESC/POS docket, the real print path). Kept as one function so the two
// print paths can never drift on which items land on which counter's slip.
//
// `it.id` may be a plain menuItemId or a "menuId::variant" cart key
// depending on the caller (a freshly-placed order vs the POS's own
// just-built items array) — strip any variant suffix before matching.
export function groupOrderItemsByDepartment(order, { getDepartmentForItem, menu }) {
  const unitOf = (it) =>
    menu.find((m) => m.id === (it.menuItemId || String(it.id).split('::')[0]))?.unit || 'pcs'

  const groups = new Map()
  order.items.forEach((it) => {
    const dept = getDepartmentForItem(it.id)
    const id = dept?.id || 'kitchen'
    const name = dept?.name || 'Kitchen'
    if (!groups.has(id)) groups.set(id, { name, items: [] })
    groups.get(id).items.push(it)
  })

  return { slips: [...groups.values()], unitOf }
}
