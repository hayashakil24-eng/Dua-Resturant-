// Daily closing — port of AppContext.jsx's saveDailyClosing, but the report is
// built server-side (authoritative) via core/closing.ts buildClosingReport
// rather than trusting a client-computed figure. The frontend computed the
// report in the Reports page and passed it in; here we recompute from the
// day's orders + transactions so a saved closing can't be tampered with.

import { prisma } from '../db/client.js'
import { buildClosingReport, toDayStr, type ClosingOrder, type ClosingTransaction } from '../core/closing.js'
import type { InventoryItemLike, RecipeLike } from '../core/inventoryFlow.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'

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

// Preview the closing figures for a date without saving (Reports page).
export async function buildReport(dateStr?: string) {
  const day = dateStr || toDayStr(new Date())
  const { closingOrders, closingTxns, inv, rec } = await gather()
  return buildClosingReport(closingOrders, closingTxns, day, inv, rec)
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
// frontend gate) — a same-day Unpaid order must be resolved to Udhaar or
// Complimentary before that day can be closed, checked here regardless of
// whether the request came through the Closing page's own block.
async function assertNoPendingOrders(day: string): Promise<void> {
  const candidates = await prisma.order.findMany({
    where: { payment: 'Unpaid', cancelled: false },
    select: { id: true, createdAt: true },
  })
  const pending = candidates.filter((o) => toDayStr(o.createdAt) === day)
  if (pending.length > 0) {
    throw new ServiceError(
      `${pending.length} bill(s) are still unpaid for ${day} — mark each as Udhaar or Complimentary before closing.`,
      409,
    )
  }
}

export async function saveDailyClosing(ctx: Ctx, dateStr?: string) {
  const day = dateStr || toDayStr(new Date())
  await assertNoPendingOrders(day)
  const report = await buildReport(day)
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
    return saved
  })
  return { record, report }
}
