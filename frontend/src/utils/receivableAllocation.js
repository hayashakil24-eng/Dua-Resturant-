// Settlement payments against a receivable are a single lump-sum balance
// reduction — ReceivableLedgerEntry.orderId is charges-only (see
// backend/prisma/schema.prisma), so a payment never records which specific
// order(s) it paid down. To show how much of ONE order's udhaar has been
// recovered, we derive it: the account's payments are walked oldest-charge-
// first, so the earliest order on the account absorbs money before a later
// one does — the same order the account's own running balance shrinks in.
export function paidAgainstCharge(receivable, orderServerId) {
  if (!receivable) return { paid: 0, remaining: 0 }
  const charges = [...(receivable.charges || [])].sort((a, b) => new Date(a.at) - new Date(b.at))
  let pool = (receivable.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
  for (const c of charges) {
    const amt = Number(c.amount || 0)
    const paid = Math.min(pool, amt)
    pool -= paid
    if (c.orderId === orderServerId) return { paid, remaining: amt - paid }
  }
  return { paid: 0, remaining: 0 }
}
