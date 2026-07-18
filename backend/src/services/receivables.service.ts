// Account receivables (credit accounts) — port of AppContext.jsx's
// addReceivable / recordReceivablePayment. The udhaar-charge path lives in
// orders.service (markOrderUdhaar), writing to the same unified ledger
// (ReceivableLedgerEntry with a type discriminator — schema.prisma).

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

export async function addReceivable(ctx: Ctx, input: { name?: string; amount?: number; type?: string; notes?: string }) {
  const name = (input.name ?? '').trim()
  if (!name) throw new ServiceError('Account name is required.')
  const amt = Math.max(0, Number(input.amount) || 0)
  return prisma.$transaction(async (tx) => {
    const rcv = await tx.receivable.create({
      data: { name, type: input.type || 'customer', balance: amt, status: amt > 0 ? 'open' : 'settled', notes: input.notes ?? '' },
    })
    await writeAudit(tx, { action: 'RECEIVABLE_ADDED', actor: ctx.actor, details: { account: name, amount: amt } })
    return rcv
  })
}

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
