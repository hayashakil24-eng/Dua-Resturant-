// Where the handed-over cash physically is right now.
//
// Cash flows Cashier → Manager/Admin → Admin. Summing every accepted handover
// double-counts the middle leg (a manager's Rs.5,000 would be counted once when
// the cashier gave it up and again when the admin received it) and answers the
// wrong question anyway — the useful figure is who is holding what.
//
// Attribution is by `resolvedBy` (whoever actually accepted the cash), NOT by
// `toName`: a shift-end handover is addressed to the role string "Admin" /
// "Manager" and only names a person once someone signs for it. Whatever that
// person later forwards on is netted back out via fromName/fromRole.
//
// Must mirror cashHeldBy() in backend/src/services/shifts.service.ts, which
// caps how much a manager is allowed to forward.

const ROLE_ORDER = ['Admin', 'Manager']

export function cashPositions(pendingHandovers = [], lastClosingAt = null) {
  // Scoped to the open business session, so it resets at day close with every
  // other money figure on the dashboard.
  const sinceMs = lastClosingAt ? new Date(lastClosingAt).getTime() : null
  const inSession = (h) =>
    sinceMs === null || new Date(h.resolvedAt || h.initiatedAt).getTime() > sinceMs

  const byRole = new Map() // role → Map(name → amount)
  const bump = (role, name, delta) => {
    if (!role || !name) return
    if (!byRole.has(role)) byRole.set(role, new Map())
    const people = byRole.get(role)
    people.set(name, (people.get(name) || 0) + delta)
  }

  for (const h of pendingHandovers) {
    if (h.status !== 'accepted' || !inSession(h)) continue
    bump(h.toRole, h.resolvedBy || h.toName, h.amount)
    // fromRole is null on handovers created before Manager → Admin existed —
    // all cashier-initiated, so there is nothing to net out.
    if (h.fromRole && h.fromRole !== 'Cashier') bump(h.fromRole, h.fromName, -h.amount)
  }

  const roles = [...byRole.entries()]
    .map(([role, people]) => ({
      role,
      amount: [...people.values()].reduce((s, n) => s + n, 0),
      people: [...people.entries()]
        .map(([name, amount]) => ({ name, amount }))
        .filter((p) => p.amount !== 0)
        .sort((a, b) => b.amount - a.amount),
    }))
    .filter((r) => r.amount !== 0 || r.people.length > 0)
    .sort((a, b) => {
      const ai = ROLE_ORDER.indexOf(a.role)
      const bi = ROLE_ORDER.indexOf(b.role)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

  return { roles, total: roles.reduce((s, r) => s + r.amount, 0) }
}

// What one person is still holding — the cap on how much they may forward.
export function cashHeldBy(pendingHandovers, lastClosingAt, name, role) {
  const { roles } = cashPositions(pendingHandovers, lastClosingAt)
  const found = roles.find((r) => r.role === role)?.people.find((p) => p.name === name)
  return found?.amount ?? 0
}
