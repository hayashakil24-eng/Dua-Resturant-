// Accounting ledger — port of AppContext.jsx's addTransaction/deleteTransaction.
// txnNumber is minted server-side via the Sequence table (core/ids.ts), same
// mechanism as orderNumber — replacing the frontend's client-side txnSeq.

import { prisma } from '../db/client.js'
import { nextSequence } from '../core/ids.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'

interface Ctx {
  actor: Actor
}

export async function listTransactions() {
  return prisma.transaction.findMany({ orderBy: { date: 'desc' } })
}

export async function addTransaction(ctx: Ctx, input: { type?: string; category?: string; description?: string; amount?: number; date?: string }) {
  if (input.type !== 'income' && input.type !== 'expense') throw new ServiceError('Transaction type must be income or expense.')
  const amount = Number(input.amount)
  if (!Number.isFinite(amount)) throw new ServiceError('A valid amount is required.')
  return prisma.$transaction(async (tx) => {
    const txnNumber = await nextSequence(tx, 'transaction')
    const txn = await tx.transaction.create({
      data: {
        txnNumber,
        type: input.type as string,
        category: input.category || 'Other',
        description: input.description ?? null,
        amount: Math.round(amount),
        date: input.date ? new Date(input.date) : new Date(),
      },
    })
    await writeAudit(tx, {
      action: 'TRANSACTION_ADDED',
      actor: ctx.actor,
      details: { txnId: `TXN-${txnNumber}`, type: txn.type, category: txn.category, amount: txn.amount },
    })
    return txn
  })
}

export async function deleteTransaction(ctx: Ctx, id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUnique({ where: { id } })
    if (!existing) throw new ServiceError('Transaction not found.', 404)
    await tx.transaction.delete({ where: { id } })
    await writeAudit(tx, { action: 'TRANSACTION_DELETED', actor: ctx.actor, details: { txnId: `TXN-${existing.txnNumber}` } })
    return { success: true }
  })
}
