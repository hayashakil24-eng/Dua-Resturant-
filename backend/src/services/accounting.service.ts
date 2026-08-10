// Accounting ledger — port of AppContext.jsx's addTransaction/deleteTransaction.
// txnNumber is minted server-side via the Sequence table (core/ids.ts), same
// mechanism as orderNumber — replacing the frontend's client-side txnSeq.

import { prisma } from '../db/client.js'
import { nextSequence } from '../core/ids.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'
import { enqueueOutbox } from '../sync/outbox.js'
import { canModify } from '../core/permissions.js'

interface Ctx {
  actor: Actor
}

export async function listTransactions() {
  return prisma.transaction.findMany({ orderBy: { date: 'desc' } })
}

// Ledger categories minted by other flows. They are ordinary expenses to every
// report — the point of routing stock purchases and salary advances through the
// same Transaction table is that no reporting code has to learn about them.
export const PURCHASE_CATEGORY = 'Inventory Purchase'
export const ADVANCE_CATEGORY = 'Staff Advance'
export const SALARY_CATEGORY = 'Staff Salary'
// Mirrors frontend/src/utils/accounting.js's MAINTENANCE_CATEGORY/isMaintenance
// — "Cafe Ali Maintenance" is its own itemized bucket (type/vendor), not just
// another expense category. Old rows saved as plain "Maintenance" (before the
// rename) still count.
export const MAINTENANCE_CATEGORY = 'Cafe Ali Maintenance'
export const isMaintenance = (category: string | null | undefined): boolean =>
  category === MAINTENANCE_CATEGORY || category === 'Maintenance'
// Daily kitchen-staff wages (Butcher/Tandoor/Kitchen Double, ...) — tracked
// the same way Maintenance is (a type + who was paid), under its own category.
// Mirrors frontend/src/utils/accounting.js's DAILY_WAGE_CATEGORY/isDailyWage.
export const DAILY_WAGE_CATEGORY = 'Daily Wages'
export const isDailyWage = (category: string | null | undefined): boolean => category === DAILY_WAGE_CATEGORY
export const hasItemizedFields = (category: string | null | undefined): boolean => isMaintenance(category) || isDailyWage(category)

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// Mint a ledger row from inside a caller's transaction (stock purchase, salary
// advance). Deliberately not addTransaction(): that one opens its own
// prisma.$transaction and writes its own audit entry, so the purchase/advance
// would be committed separately from the expense it is supposed to be atomic
// with. The caller audits the business event instead.
export async function createLedgerEntry(
  tx: Tx,
  input: { type: 'income' | 'expense'; category: string; description?: string | null; amount: number; date: Date; source: string; sourceId: string },
) {
  const txnNumber = await nextSequence(tx, 'transaction')
  const txn = await tx.transaction.create({
    data: {
      txnNumber,
      type: input.type,
      category: input.category,
      description: input.description ?? null,
      amount: Math.round(input.amount),
      date: input.date,
      source: input.source,
      sourceId: input.sourceId,
    },
  })
  await enqueueOutbox(tx, 'Transaction', txn.id, txn)
  return txn
}

// Retract a ledger row minted by createLedgerEntry, when its originating record
// is removed. Silent no-op if it was already deleted by hand from Accounting.
export async function deleteLedgerEntry(tx: Tx, transactionId: string | null | undefined) {
  if (!transactionId) return
  await tx.transaction.deleteMany({ where: { id: transactionId } })
}

export async function addTransaction(
  ctx: Ctx,
  input: { type?: string; category?: string; description?: string; amount?: number; date?: string; subCategory?: string; vendor?: string },
) {
  // Cashier reaches this route via 'expenseEntry' (create-only quick-add), not
  // full 'accounting' — the route only checks "is either permission granted",
  // so re-check here: an expenseEntry-only actor can never post income, no
  // matter what the request body says.
  const type = canModify(ctx.actor.role, 'accounting') ? input.type : 'expense'
  if (type !== 'income' && type !== 'expense') throw new ServiceError('Transaction type must be income or expense.')
  const amount = Number(input.amount)
  if (!Number.isFinite(amount)) throw new ServiceError('A valid amount is required.')
  const category = input.category || 'Other'
  return prisma.$transaction(async (tx) => {
    const txnNumber = await nextSequence(tx, 'transaction')
    const txn = await tx.transaction.create({
      data: {
        txnNumber,
        type,
        category,
        description: input.description ?? null,
        amount: Math.round(amount),
        date: input.date ? new Date(input.date) : new Date(),
        subCategory: hasItemizedFields(category) ? input.subCategory || null : null,
        vendor: hasItemizedFields(category) ? input.vendor || null : null,
      },
    })
    await writeAudit(tx, {
      action: 'TRANSACTION_ADDED',
      actor: ctx.actor,
      details: { txnId: `TXN-${txnNumber}`, type: txn.type, category: txn.category, amount: txn.amount },
    })
    await enqueueOutbox(tx, 'Transaction', txn.id, txn)
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
