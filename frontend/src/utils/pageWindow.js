// Page numbers to render with … gaps: always first/last + a window around the
// current page (e.g. 1 … 4 5 6 … 12), so the control stays compact for many
// pages. Shared by the table picker and the Tables manage list — a restaurant
// here runs 300+ tables, so both paginate rather than rendering everything.
export function pageWindow(current, count) {
  const pages = new Set([1, count, current, current - 1, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b)
  const out = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
}
