// Cash-drawer reconciliation + mid-shift handovers — port of AppContext.jsx's
// startShift/pauseShift/resumeShift/endShift/calculateShiftSales and
// initiateHandover/acceptHandover/rejectHandover.
//
// Sales are attributed to a shift by order.shiftId (stamped at addOrder/markPaid
// time), NOT by timestamp — preserved from the frontend so seed/demo orders and
// other shifts never leak into a drawer's expected cash (../../CLAUDE.md).
//
// The frontend kept a single global `activeShift`; here "the active shift" is
// the one ShiftReconciliation row with status 'active' (single drawer, matching
// Phase 1's single-device scope — Phase 2 may refine per cashier). Unlike the
// frontend, an accepted handover is NOT copied onto the shift; the handed-over
// total is computed by querying accepted PendingHandover rows (schema.prisma).

import type { Prisma } from '@prisma/client'
import { prisma } from '../db/client.js'
import { orderTotal } from '../core/orderTotal.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError, NotFoundError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'
import { broadcastEvent } from '../realtime/broadcast.js'
import { enqueueOutbox } from '../sync/outbox.js'

type Tx = Prisma.TransactionClient
interface Ctx {
  actor: Actor
}
type Shift = Prisma.ShiftReconciliationGetPayload<Record<string, never>>

async function computeSales(tx: Tx, shift: Shift) {
  const orders = await tx.order.findMany({ where: { shiftId: shift.id, payment: 'Paid', cancelled: false }, include: { items: true } })
  let totalCashSales = 0
  let totalCardSales = 0
  for (const o of orders) {
    const total = orderTotal(o.items.map((it) => ({ price: it.price, qty: it.qty })), o.discountAmount ?? 0, o.gstRate).total
    if (o.method === 'Cash') totalCashSales += total
    else if (o.method === 'Card') totalCardSales += total
  }
  const accepted = await tx.pendingHandover.findMany({ where: { shiftId: shift.id, status: 'accepted' } })
  const handedOver = accepted.reduce((s, h) => s + h.amount, 0)
  return { totalCashSales, totalCardSales, handedOver, expectedCash: shift.openingCash + totalCashSales - handedOver }
}

async function activeShift(tx: Tx): Promise<Shift | null> {
  return tx.shiftReconciliation.findFirst({ where: { status: 'active' }, orderBy: { shiftStartTime: 'desc' } })
}

// ---- Reads ----------------------------------------------------------------

export async function listShifts() {
  return prisma.shiftReconciliation.findMany({ orderBy: { shiftStartTime: 'desc' } })
}

export async function getActiveShift() {
  return prisma.shiftReconciliation.findFirst({ where: { status: { in: ['active', 'paused'] } }, orderBy: { shiftStartTime: 'desc' } })
}

export async function calculateShiftSales(shiftId: string) {
  const shift = await prisma.shiftReconciliation.findUnique({ where: { id: shiftId } })
  if (!shift) return null
  return computeSales(prisma, shift)
}

export async function listPendingHandovers() {
  return prisma.pendingHandover.findMany({ orderBy: { initiatedAt: 'desc' } })
}

// ---- Shift lifecycle ------------------------------------------------------

export async function startShift(ctx: Ctx, openingCash: number) {
  const opening = Math.max(0, Number(openingCash) || 0)
  const shift = await prisma.$transaction(async (tx) => {
    // Single drawer: refuse to open a second concurrent shift.
    if (await activeShift(tx)) throw new ServiceError('A shift is already open. Close it before starting a new one.')
    const created = await tx.shiftReconciliation.create({
      data: {
        cashierName: ctx.actor.name,
        role: ctx.actor.role,
        shiftStartTime: new Date(),
        openingCash: opening,
        expectedCash: opening,
        status: 'active',
        staffId: ctx.actor.id,
      },
    })
    // Enqueued here, before any order can reference this shift, so a synced
    // Order's shiftId foreign key always resolves on the VPS side — Postgres
    // enforces that constraint even if the local SQLite copy doesn't.
    await enqueueOutbox(tx, 'ShiftReconciliation', created.id, created)
    return created
  })
  broadcastEvent({ action: 'SHIFT_STARTED', actor: ctx.actor, details: { shiftId: shift.id, cashierName: shift.cashierName } })
  return shift
}

export async function pauseShift(ctx: Ctx) {
  const shift = await prisma.$transaction(async (tx) => {
    const shift = await activeShift(tx)
    if (!shift) throw new ServiceError('No active shift to pause.')
    const updated = await tx.shiftReconciliation.update({ where: { id: shift.id }, data: { status: 'paused', pausedAt: new Date() } })
    await enqueueOutbox(tx, 'ShiftReconciliation', updated.id, updated)
    return updated
  })
  broadcastEvent({ action: 'SHIFT_PAUSED', actor: ctx.actor, details: { shiftId: shift.id } })
  return shift
}

export async function resumeShift(ctx: Ctx) {
  const shift = await prisma.$transaction(async (tx) => {
    const paused = await tx.shiftReconciliation.findFirst({ where: { status: 'paused' }, orderBy: { shiftStartTime: 'desc' } })
    if (!paused) throw new ServiceError('No paused shift to resume.')
    const updated = await tx.shiftReconciliation.update({
      where: { id: paused.id },
      data: { status: 'active', resumedAt: new Date(), resumeCount: paused.resumeCount + 1 },
    })
    await enqueueOutbox(tx, 'ShiftReconciliation', updated.id, updated)
    return updated
  })
  broadcastEvent({ action: 'SHIFT_RESUMED', actor: ctx.actor, details: { shiftId: shift.id } })
  return shift
}

export async function endShift(
  ctx: Ctx,
  shiftId: string,
  actualCash: number,
  handover: { to?: string; name?: string; reason?: string } = {},
) {
  return prisma.$transaction(async (tx) => {
    const shift = await tx.shiftReconciliation.findUnique({ where: { id: shiftId } })
    if (!shift) throw new NotFoundError('Shift not found.')
    const sales = await computeSales(tx, shift)
    const actual = Math.max(0, Number(actualCash) || 0)
    const difference = sales.expectedCash - actual
    // Within Rs.10 counts as matched; positive difference = shortage, negative = excess.
    const status = Math.abs(difference) < 10 ? 'matched' : difference > 0 ? 'shortage' : 'excess'
    const handedTo = handover.to ?? null
    const handedToName = handover.name ?? handover.to ?? null
    const handoverReason = handover.reason ?? ''
    const at = new Date()

    const closed = await tx.shiftReconciliation.update({
      where: { id: shiftId },
      data: {
        shiftEndTime: at,
        totalCashSales: sales.totalCashSales,
        totalCardSales: sales.totalCardSales,
        expectedCash: sales.expectedCash,
        actualCash: actual,
        difference,
        status,
        handedTo,
        handedToName,
        handoverReason,
      },
    })
    await writeAudit(tx, {
      action: 'SHIFT_RECONCILIATION',
      actor: { id: ctx.actor.id, name: closed.cashierName, role: ctx.actor.role },
      at,
      details: { expectedCash: sales.expectedCash, actualCash: actual, difference, status, handedTo, handedToName, handoverReason },
    })
    await enqueueOutbox(tx, 'ShiftReconciliation', closed.id, closed)
    return closed
  })
}

// ---- Handovers ------------------------------------------------------------

export async function initiateHandover(ctx: Ctx, input: { amount?: number; toName?: string; toRole?: string; reason?: string }) {
  return prisma.$transaction(async (tx) => {
    const shift = await activeShift(tx)
    if (!shift) throw new ServiceError('No active shift.')
    const amt = Math.max(0, Number(input.amount) || 0)
    const current = (await computeSales(tx, shift)).expectedCash
    if (amt <= 0 || amt > current) throw new ServiceError('Enter a valid amount within the drawer balance.')
    const at = new Date()
    const ho = await tx.pendingHandover.create({
      data: {
        shiftId: shift.id,
        fromName: shift.cashierName,
        toName: input.toName || 'Manager',
        toRole: input.toRole || 'Manager',
        amount: amt,
        reason: input.reason ?? '',
        status: 'pending',
        initiatedAt: at,
      },
    })
    await writeAudit(tx, {
      action: 'HANDOVER_INITIATED',
      actor: { id: ctx.actor.id, name: ho.fromName, role: 'Cashier' },
      at,
      details: { amount: amt, from: ho.fromName, to: ho.toName },
    })
    return ho
  })
}

export async function acceptHandover(ctx: Ctx, id: string) {
  return prisma.$transaction(async (tx) => {
    const ho = await tx.pendingHandover.findUnique({ where: { id } })
    if (!ho || ho.status !== 'pending') throw new NotFoundError('Handover not found.')
    const at = new Date()
    const updated = await tx.pendingHandover.update({ where: { id }, data: { status: 'accepted', resolvedAt: at, resolvedBy: ctx.actor.name } })
    await writeAudit(tx, {
      action: 'HANDOVER_ACCEPTED',
      actor: ctx.actor,
      at,
      details: { amount: ho.amount, from: ho.fromName, to: ho.toName },
    })
    return updated
  })
}

export async function rejectHandover(ctx: Ctx, id: string, reason = '') {
  return prisma.$transaction(async (tx) => {
    const ho = await tx.pendingHandover.findUnique({ where: { id } })
    if (!ho || ho.status !== 'pending') throw new NotFoundError('Handover not found.')
    const at = new Date()
    const updated = await tx.pendingHandover.update({ where: { id }, data: { status: 'rejected', rejectReason: reason, resolvedAt: at, resolvedBy: ctx.actor.name } })
    await writeAudit(tx, {
      action: 'HANDOVER_REJECTED',
      actor: ctx.actor,
      at,
      details: { amount: ho.amount, from: ho.fromName, to: ho.toName, reason },
    })
    return updated
  })
}
