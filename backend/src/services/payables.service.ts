// Supplier payables — money the cafe owes for stock bought on credit
// ("udhar"). Mirror-image of receivables.service.ts (money customers owe the
// cafe): same running-balance-plus-immutable-ledger shape, same "born only
// from another flow, never a manual add" convention (here: inventory
// .service.ts's recordPurchase, when a purchase is logged unpaid).

import { prisma } from '../db/client.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'
import { createLedgerEntry, PURCHASE_CATEGORY } from './accounting.service.js'
import { enqueueOutbox } from '../sync/outbox.js'

interface Ctx {
  actor: Actor
}

export async function listPayables() {
  return prisma.payable.findMany({ include: { ledger: { orderBy: { at: 'desc' } } }, orderBy: { createdAt: 'desc' } })
}

// `amount` omitted ⇒ settle the whole outstanding balance. Unlike a
// receivable payment (money coming IN, already accounted for via the
// order's own ledger), cash actually leaves the drawer here right now — so
// this is also the point where the expense finally reaches the accounting
// ledger (cash-basis, same as every other Transaction: the purchase itself
// never minted one while it sat unpaid).
export async function recordPayablePayment(
  ctx: Ctx,
  id: string,
  amount: number | null | undefined,
  opts: { method?: string; notes?: string } = {},
) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.payable.findUnique({ where: { id } })
    if (!p || p.status === 'settled') throw new ServiceError('Account not found or already settled.')
    const pay = amount == null ? p.balance : Math.max(0, Number(amount) || 0)
    if (pay <= 0 || pay > p.balance) throw new ServiceError('Enter a valid amount up to the outstanding balance.')
    const at = new Date()
    const remaining = p.balance - pay
    const settled = remaining <= 0
    const method = opts.method || 'Cash'
    const notes = opts.notes ?? ''

    const updated = await tx.payable.update({
      where: { id },
      data: {
        balance: settled ? 0 : remaining,
        status: settled ? 'settled' : 'open',
        ledger: { create: { type: 'payment', amount: pay, method, notes, by: ctx.actor.name, at } },
      },
      include: { ledger: { orderBy: { at: 'desc' } } },
    })

    const txn = await createLedgerEntry(tx, {
      type: 'expense',
      category: PURCHASE_CATEGORY,
      description: `Supplier payment — ${p.name}`,
      amount: pay,
      date: at,
      source: 'payable_payment',
      sourceId: id,
    })

    await writeAudit(tx, {
      action: settled ? 'PAYABLE_SETTLED' : 'PAYABLE_PAYMENT',
      actor: ctx.actor,
      at,
      details: { supplier: p.name, amount: pay, remaining: settled ? 0 : remaining, method, notes, txnId: txn.id },
    })
    await enqueueOutbox(tx, 'Payable', updated.id, { id: updated.id, name: updated.name, balance: updated.balance, status: updated.status, notes: updated.notes })
    return { payable: updated, settled }
  })
}
