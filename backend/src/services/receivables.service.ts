// Account receivables (credit accounts) — port of AppContext.jsx's
// recordReceivablePayment. Accounts themselves are created only by the
// udhaar-charge path in orders.service (markOrderUdhaar), writing to the same
// unified ledger (ReceivableLedgerEntry with a type discriminator —
// schema.prisma).

import { prisma } from '../db/client.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'

interface Ctx {
  actor: Actor
}

export async function listReceivables() {
  return prisma.receivable.findMany({ include: { ledger: { orderBy: { at: 'desc' } } }, orderBy: { createdAt: 'desc' } })
}

// There is deliberately no addReceivable here: an account is only ever born
// from an unpaid order going on account (orders.service's markOrderUdhaar,
// which creates the Receivable when the customer name is new). That keeps every
// balance traceable to a real order instead of a hand-typed opening figure.

// `amount` omitted ⇒ settle the whole outstanding balance.
export async function recordReceivablePayment(
  ctx: Ctx,
  id: string,
  amount: number | null | undefined,
  opts: { method?: string; notes?: string } = {},
) {
  return prisma.$transaction(async (tx) => {
    const rcv = await tx.receivable.findUnique({ where: { id } })
    if (!rcv || rcv.status === 'settled') throw new ServiceError('Account not found or already settled.')
    const pay = amount == null ? rcv.balance : Math.max(0, Number(amount) || 0)
    if (pay <= 0 || pay > rcv.balance) throw new ServiceError('Enter a valid amount up to the outstanding balance.')
    const at = new Date()
    const remaining = rcv.balance - pay
    const settled = remaining <= 0
    const method = opts.method || 'Cash'
    const notes = opts.notes ?? ''

    const updated = await tx.receivable.update({
      where: { id },
      data: {
        balance: settled ? 0 : remaining,
        status: settled ? 'settled' : 'open',
        ledger: { create: { type: 'payment', amount: pay, method, notes, by: ctx.actor.name, at } },
      },
      include: { ledger: { orderBy: { at: 'desc' } } },
    })
    await writeAudit(tx, {
      action: settled ? 'RECEIVABLE_SETTLED' : 'RECEIVABLE_PAYMENT',
      actor: ctx.actor,
      at,
      details: { account: rcv.name, amount: pay, remaining: settled ? 0 : remaining, method, notes },
    })
    return { receivable: updated, settled }
  })
}
