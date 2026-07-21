// Daily closing — port of AppContext.jsx's saveDailyClosing, but the report is
// built server-side (authoritative) via core/closing.ts buildClosingReport
// rather than trusting a client-computed figure. The frontend computed the
// report in the Reports page and passed it in; here we recompute from the
// day's orders + transactions so a saved closing can't be tampered with.

import { prisma } from '../db/client.js'
import { buildClosingReport, toDayStr, type ClosingOrder, type ClosingTransaction } from '../core/closing.js'
import type { InventoryItemLike, RecipeLike } from '../core/inventoryFlow.js'
import { getActiveShift } from './shifts.service.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'
import { enqueueOutbox } from '../sync/outbox.js'

interface Ctx {
  actor: Actor
}

async function gather() {
  const [orders, transactions, inventory, recipes] = await Promise.all([
    prisma.order.findMany({ include: { items: true } }),
    prisma.transaction.findMany(),
    prisma.inventoryItem.findMany(),
    prisma.recipe.findMany({ where: { status: 'approved' }, include: { ingredients: true } }),
  ])

  const closingOrders: ClosingOrder[] = orders.map((o) => ({
    createdAt: o.createdAt,
    cancelled: o.cancelled,
    payment: o.payment,
    method: o.method,
    items: o.items.map((it) => ({ price: it.price, qty: it.qty, menuItemId: it.menuItemId, name: it.name })),
    discountAmount: o.discountAmount ?? 0,
    gstRate: o.gstRate,
    onlineAccountName: o.onlineAccountName,
    materialLoss: o.materialLoss ?? 0,
  }))
  const closingTxns: ClosingTransaction[] = transactions.map((t) => ({ type: t.type, amount: t.amount, date: t.date, category: t.category }))
  const inv: InventoryItemLike[] = inventory.map((i) => ({ id: i.id, unit: i.unit, stock: i.stock, threshold: i.threshold, costPerUnit: i.costPerUnit }))
  const rec: RecipeLike[] = recipes.map((r) => ({
    menuItemId: r.menuItemId,
    status: r.status,
    ingredients: r.ingredients.map((ing) => ({ inventoryItemId: ing.inventoryItemId, itemName: ing.itemName, quantity: ing.quantity, unit: ing.unit })),
  }))
  return { closingOrders, closingTxns, inv, rec }
}

// The business-day "session" boundary: the moment the day was last closed.
// Everything after it belongs to the open session; null before the first ever
// closing. A single timestamp (not per-date) so a forgotten-then-caught-up
// close spanning two calendar days still reports one continuous session.
async function getBoundaryIso(): Promise<string | null> {
  const last = await prisma.dailyClosing.findFirst({ orderBy: { closingTime: 'desc' } })
  return last ? last.closingTime.toISOString() : null
}

// Preview the closing figures for the current open session, without saving
// (Reports/Closing page). Scoped to everything since the last closing.
export async function buildReport(dateStr?: string) {
  const day = dateStr || toDayStr(new Date())
  const sinceIso = await getBoundaryIso()
  const { closingOrders, closingTxns, inv, rec } = await gather()
  return buildClosingReport(closingOrders, closingTxns, day, inv, rec, sinceIso)
}

// The most recent saved closing, raw (not merged with report fields the way
// listClosings() shapes it for the frontend) — used by the WhatsApp report
// path (src/whatsapp/schedule.ts, src/vps/app.ts's webhook), which wants the
// record's own reportJson/date, not the frontend's flattened view.
export async function getLatestClosing() {
  return prisma.dailyClosing.findFirst({ orderBy: { closingTime: 'desc' } })
}

// Return each saved closing with its frozen report merged back in (the frontend
// renders a saved record as if it *were* the report — grossSale/netSale/accounts
// etc. — plus the closedBy/closingTime metadata columns).
export async function listClosings() {
  const rows = await prisma.dailyClosing.findMany({ orderBy: { closingTime: 'desc' } })
  return rows.map((r) => {
    let report: Record<string, unknown> = {}
    try {
      report = JSON.parse(r.reportJson)
    } catch {
      /* leave empty */
    }
    return {
      ...report,
      id: r.id,
      date: r.date,
      closedBy: r.closedBy,
      closedByRole: r.closedByRole,
      closingTime: r.closingTime.toISOString(),
      totalSales: r.totalSales,
    }
  })
}

// UI-only checks aren't enough (CLAUDE.md's audit-trail convention — every
// mutating check gets an independent server-side re-check, not just a
// frontend gate) — a still-open Unpaid order in this session must be resolved
// to Udhaar or Complimentary before the day can be closed, checked here
// regardless of whether the request came through the Closing page's own block.
async function assertNoPendingOrders(sinceIso: string | null): Promise<void> {
  const candidates = await prisma.order.findMany({
    where: { payment: 'Unpaid', cancelled: false },
    select: { id: true, createdAt: true },
  })
  const sinceMs = sinceIso ? new Date(sinceIso).getTime() : null
  const today = toDayStr(new Date())
  const pending = candidates.filter((o) =>
    sinceMs !== null ? o.createdAt.getTime() > sinceMs : toDayStr(o.createdAt) === today,
  )
  if (pending.length > 0) {
    throw new ServiceError(
      `${pending.length} bill(s) are still unpaid — mark each as Udhaar or Complimentary before closing.`,
      409,
    )
  }
}

// The cash drawer must be reconciled (shift ended) before the business day is
// closed, so the day's cash is accounted for — mirrors the "close the drawer
// first" half of the Full Business-Day Close (demand.md #9).
async function assertNoActiveShift(): Promise<void> {
  const open = await getActiveShift() // active OR paused
  if (open) {
    throw new ServiceError('A cash drawer is still open — end the shift (reconcile the drawer) before closing the day.', 409)
  }
}

// "Day lock": once closed, there's nothing to close again until new activity
// happens — an empty session (no settled sale, no expense) can't be re-closed.
function assertHasActivity(report: { totalOrders: number; expenses: number }): void {
  if (report.totalOrders === 0 && report.expenses === 0) {
    throw new ServiceError('Nothing new to close — this session has no sales since the last closing.', 409)
  }
}

export async function saveDailyClosing(ctx: Ctx, dateStr?: string) {
  const day = dateStr || toDayStr(new Date())
  const sinceIso = await getBoundaryIso()
  await assertNoActiveShift()
  await assertNoPendingOrders(sinceIso)
  const report = await buildReport(day)
  assertHasActivity(report)
  const closingTime = new Date()
  const record = await prisma.$transaction(async (tx) => {
    const saved = await tx.dailyClosing.create({
      data: {
        date: report.date,
        closedBy: ctx.actor.name,
        closedByRole: ctx.actor.role,
        closingTime,
        totalSales: report.netSale,
        reportJson: JSON.stringify(report),
      },
    })
    await writeAudit(tx, { action: 'DAY_CLOSED', actor: ctx.actor, at: closingTime, details: { date: report.date, totalSales: report.netSale } })
    // Synced (docs/05-phase-4-vps-sync.md "Production hardening") so the
    // WhatsApp webhook's on-demand report (src/vps/app.ts) has real closing
    // data to reply with — the VPS never generates a report from scratch,
    // only ever replays the local server's own saved closings.
    await enqueueOutbox(tx, 'DailyClosing', saved.id, saved)
    return saved
  })
  return { record, report }
}
