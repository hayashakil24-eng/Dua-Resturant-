// Table label maths — "which name does the next table in this hall get?".
//
// Two label shapes exist in real data: the seeded halls write "<cat><n>" with no
// space (A1..A40, HUT1..HUT20, seedBaseline.ts) while renameTableCategory wrote
// "<cat> <n>" with one (A 1..A 40). Both are counted as occupying a slot, so a
// hall that has drifted into holding both never hands out a number twice.
//
// Kept Prisma-free in core/ so the frontend can mirror it for a live preview
// (frontend/src/utils/tableLabels.js) — the server is still the authority.

export interface LabelMember {
  id: number
  number: string
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The slot number a label occupies in its hall, or null when the label doesn't
// follow the pattern at all ("Delivery", "Corner window").
function slotOf(category: string, label: string): number | null {
  const m = new RegExp(`^${escapeRe(category)}\\s*(\\d+)$`, 'i').exec((label ?? '').trim())
  return m ? Number(m[1]) : null
}

// Whichever separator this hall already favours, so a new table doesn't look
// foreign next to its neighbours. A brand-new hall gets no space for a short
// code (A, HUT) and a space for a word ("Roof 1" reads better than "Roof1").
export function labelSeparator(category: string, members: LabelMember[]): string {
  let spaced = 0
  let tight = 0
  for (const m of members) {
    if (slotOf(category, m.number) == null) continue
    if (/\s/.test((m.number ?? '').trim())) spaced += 1
    else tight += 1
  }
  if (spaced > tight) return ' '
  if (tight > 0 || spaced > 0) return ''
  return category.trim().length <= 3 ? '' : ' '
}

// Highest slot in use + 1. Falls back to the member count for halls whose
// labels never matched the pattern, so numbering still moves forward.
export function nextSlot(category: string, members: LabelMember[]): number {
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

export function buildLabels(category: string, members: LabelMember[], count: number): string[] {
  const sep = labelSeparator(category, members)
  const start = nextSlot(category, members)
  return Array.from({ length: count }, (_, i) => `${category}${sep}${start + i}`)
}

// Straighten a hall whose labels have drifted (duplicates, gaps, mixed spacing)
// into 1..N by id order. Only returns the rows that actually change.
export function renumberLabels(category: string, members: LabelMember[]): { id: number; number: string }[] {
  const sep = labelSeparator(category, members)
  return [...members]
    .sort((a, b) => a.id - b.id)
    .flatMap((m, i) => {
      const number = `${category}${sep}${i + 1}`
      return number === m.number ? [] : [{ id: m.id, number }]
    })
}
