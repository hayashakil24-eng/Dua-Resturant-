// Preview twin of backend/src/core/tableLabels.ts — it exists so the add form
// can show "Ye banengi: A81, A82 … A90" before anything is saved. The server
// recomputes the labels authoritatively inside bulkAddTables; if the two ever
// disagree, the server wins (and this file is the one to fix).

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Seeded halls label "A1" (no space); an older rename wrote "A 1". Both count as
// occupying a slot, so a hall holding both never hands out a number twice.
function slotOf(category, label) {
  const m = new RegExp(`^${escapeRe(category)}\\s*(\\d+)$`, 'i').exec(String(label ?? '').trim())
  return m ? Number(m[1]) : null
}

export function labelSeparator(category, members) {
  let spaced = 0
  let tight = 0
  for (const m of members) {
    if (slotOf(category, m.number) == null) continue
    if (/\s/.test(String(m.number ?? '').trim())) spaced += 1
    else tight += 1
  }
  if (spaced > tight) return ' '
  if (tight > 0 || spaced > 0) return ''
  return category.trim().length <= 3 ? '' : ' '
}

export function nextSlot(category, members) {
  let max = 0
  let matched = 0
  for (const m of members) {
    const slot = slotOf(category, m.number)
    if (slot == null) continue
    matched += 1
    if (slot > max) max = slot
  }
  return (matched > 0 ? max : members.length) + 1
}

export function buildLabels(category, members, count) {
  const sep = labelSeparator(category, members)
  const start = nextSlot(category, members)
  return Array.from({ length: Math.max(0, count) }, (_, i) => `${category}${sep}${start + i}`)
}
