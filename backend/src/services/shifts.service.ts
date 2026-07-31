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
import { getBoundaryIso } from '../lib/businessDay.js'
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
    const total = orderTotal(o.items.map((it) => ({ price: it.price, qty: it.qty, cancelled: it.cancelled })), o.discountAmount ?? 0, o.gstRate).total
    if (o.method === 'Cash') totalCashSales += total
    else if (o.method === 'Card') totalCardSales += total
  }
  // Only mid-shift handovers reduce the drawer; a 'shift_end' handover is the
  // whole counted drawer handed over AFTER reconciliation, so it must not be
  // subtracted here (it would double-count against a shift's expectedCash).
  const accepted = await tx.pendingHandover.findMany({ where: { shiftId: shift.id, status: 'accepted', kind: 'mid_shift' } })
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

// Scoped per caller: cash positions are confidential up the chain, so a Manager
// must not be able to read what the Admin (or another manager) is holding — and
// hiding it only in the UI would still ship the numbers to their device.
//
//   Admin    — everything (owner-level).
//   Manager  — every PENDING row addressed to Manager (any manager may sign for
//              those), plus rows they personally resolved or initiated. Their
//              own forward to the Admin stays visible via fromName, so they can
//              still see whether it was accepted.
//   Cashier  — only what they handed over themselves, which is what the "waiting
//              for approval" badge in Layout.jsx reads.
//   Anyone else — nothing.
export async function listPendingHandovers(actor: Actor) {
  const rows = await prisma.pendingHandover.findMany({ orderBy: { initiatedAt: 'desc' } })
  if (actor.role === 'Admin') return rows
  if (actor.role === 'Manager') {
    return rows.filter(
      (h) =>
        (h.status === 'pending' && h.toRole === 'Manager') ||
        h.resolvedBy === actor.name ||
        h.fromName === actor.name,
    )
  }
  return rows.filter((h) => h.fromName === actor.name)
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
    // Validated before any writes, so a bad recipient can't half-close a shift.
    if (handover.to) assertReceivable(handover.to)
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

    // The counted drawer is handed over to a Manager/Admin at shift end — create
    // an approval so the recipient confirms receipt (like a mid-shift handover),
    // tagged kind:'shift_end' so it never reduces this shift's expectedCash. The
    // HANDOVER_INITIATED audit broadcasts, so the approvals page updates live.
    if (handedTo && actual > 0) {
      const ho = await tx.pendingHandover.create({
        data: {
          shiftId,
          fromName: closed.cashierName,
          fromRole: 'Cashier',
          toName: handedToName ?? 'Manager',
          toRole: handedTo,
          amount: actual,
          reason: handoverReason,
          status: 'pending',
          kind: 'shift_end',
          initiatedAt: at,
        },
      })
      await writeAudit(tx, {
        action: 'HANDOVER_INITIATED',
        actor: { id: ctx.actor.id, name: closed.cashierName, role: ctx.actor.role },
        at,
        details: { amount: actual, from: closed.cashierName, to: ho.toName, kind: 'shift_end' },
      })
    }
    return closed
  })
}

// ---- Handovers ------------------------------------------------------------

// Only these roles hold the 'handovers' permission, and a handover can now only
// be accepted by the role it is addressed to — so addressing one to anybody
// else (a waiter, or the literal 'Other' the shift-end modal used to send)
// would strand the cash with nobody able to sign for it. Rejected at creation
// rather than discovered later by an approval that never arrives.
const RECEIVING_ROLES = ['Admin', 'Manager']
function assertReceivable(toRole: string): void {
  if (!RECEIVING_ROLES.includes(toRole)) {
    throw new ServiceError(`Cash can only be handed to ${RECEIVING_ROLES.join(' or ')} — "${toRole}" cannot accept it.`, 400)
  }
}

export async function initiateHandover(ctx: Ctx, input: { amount?: number; toName?: string; toRole?: string; reason?: string }) {
  return prisma.$transaction(async (tx) => {
    const shift = await activeShift(tx)
    if (!shift) throw new ServiceError('No active shift.')
    assertReceivable(input.toRole || 'Manager')
    const amt = Math.max(0, Number(input.amount) || 0)
    const current = (await computeSales(tx, shift)).expectedCash
    if (amt <= 0 || amt > current) throw new ServiceError('Enter a valid amount within the drawer balance.')
    const at = new Date()
    const ho = await tx.pendingHandover.create({
      data: {
        shiftId: shift.id,
        fromName: shift.cashierName,
        fromRole: 'Cashier',
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

// Cash flows Cashier → Manager/Admin → Admin. A Manager runs no drawer, so
// this leg has no shift; the amount is capped by what they are actually still
// holding (accepted in, minus already forwarded on) rather than a drawer
// balance. Admin is the final destination, which is why 'handoverForward' is
// Manager-only in permissions.ts.
export async function forwardHandover(ctx: Ctx, input: { amount?: number; reason?: string }) {
  const sinceIso = await getBoundaryIso()
  return prisma.$transaction(async (tx) => {
    // One forward at a time. cashHeldBy only counts ACCEPTED rows, so a forward
    // the Admin hasn't signed for yet leaves the money still showing as held —
    // without this guard the same cash could be forwarded again and again,
    // creating several pending handovers for one physical pile of notes.
    const outstanding = await tx.pendingHandover.findFirst({
      where: { status: 'pending', kind: 'forward', fromName: ctx.actor.name },
    })
    if (outstanding) {
      throw new ServiceError(
        `You already have Rs. ${outstanding.amount} awaiting the Admin's approval. Wait for it to be accepted or rejected before handing over more.`,
      )
    }

    const amt = Math.max(0, Number(input.amount) || 0)
    const held = await cashHeldBy(tx, ctx.actor.name, ctx.actor.role, sinceIso)
    if (amt <= 0 || amt > held) {
      throw new ServiceError(`Enter a valid amount within the cash you are holding (Rs. ${held}).`)
    }
    const at = new Date()
    const ho = await tx.pendingHandover.create({
      data: {
        shiftId: null,
        fromName: ctx.actor.name,
        fromRole: ctx.actor.role,
        toName: 'Admin',
        toRole: 'Admin',
        amount: amt,
        reason: input.reason ?? '',
        status: 'pending',
        // Never 'mid_shift': there is no drawer for this to be deducted from,
        // and computeSales must not see it.
        kind: 'forward',
        initiatedAt: at,
      },
    })
    await writeAudit(tx, {
      action: 'HANDOVER_INITIATED',
      actor: ctx.actor,
      at,
      details: { amount: amt, from: ho.fromName, to: ho.toName, kind: 'forward' },
    })
    return ho
  })
}

// Cash physically held by one person right now: everything they ACCEPTED into
// their hands, minus everything they have since forwarded on. Attribution is by
// `resolvedBy` (who actually took the cash) rather than `toName`, because a
// shift-end handover is addressed to the role string "Admin"/"Manager" and only
// names a person once someone accepts it. Scoped to the open business session
// so it resets at day close with every other money figure.
async function cashHeldBy(tx: Tx, name: string, role: string, sinceIso: string | null): Promise<number> {
  const rows = await tx.pendingHandover.findMany({ where: { status: 'accepted' } })
  const sinceMs = sinceIso ? new Date(sinceIso).getTime() : null
  let held = 0
  for (const h of rows) {
    if (sinceMs !== null && new Date(h.resolvedAt ?? h.initiatedAt).getTime() <= sinceMs) continue
    if (h.resolvedBy === name) held += h.amount
    if (h.fromName === name && h.fromRole === role) held -= h.amount
  }
  return held
}

// Only the addressed role may act on a handover — a cashier handing cash to
// the Admin must be signed for by an Admin, not by any Manager who happens to
// have the 'handovers' permission. Without this the approval was effectively
// "whoever clicks first", and the accepted record named the wrong holder.
function assertAddressedTo(ho: { toRole: string; toName: string }, ctx: Ctx): void {
  if (ho.toRole !== ctx.actor.role) {
    throw new ServiceError(`This handover is addressed to ${ho.toRole} — only ${ho.toRole} can approve it.`, 403)
  }
}

export async function acceptHandover(ctx: Ctx, id: string) {
  return prisma.$transaction(async (tx) => {
    const ho = await tx.pendingHandover.findUnique({ where: { id } })
    if (!ho || ho.status !== 'pending') throw new NotFoundError('Handover not found.')
    assertAddressedTo(ho, ctx)
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
    assertAddressedTo(ho, ctx)
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
