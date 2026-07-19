// Orders service — the DB-backed port of AppContext.jsx's order mutators,
// mirroring them 1:1 in name and behavior (docs/02-phase-1). Every function
// that changes money/inventory runs inside a Prisma transaction so the state
// change, the recipe-driven inventory deduction/restock, the ID sequence bump,
// and the audit row all commit together — the frontend achieved this with a
// single synchronous setState batch; the backend needs an explicit transaction.
//
// Orders are never hard-deleted here either — cancel/udhaar/complimentary are
// status transitions, same as the frontend (../../CLAUDE.md).

import type { Prisma } from '@prisma/client'
import { prisma } from '../db/client.js'
import { nextSequence } from '../core/ids.js'
import { orderTotal } from '../core/orderTotal.js'
import {
  calculateDeductions,
  calculateRestocks,
  calculateOrderMaterialCost,
  type InventoryItemLike,
  type RecipeLike,
  type DeductionEntry,
} from '../core/inventoryFlow.js'
import { writeAudit } from '../lib/audit.js'
import { NotFoundError, ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'
import { broadcastEvent } from '../realtime/broadcast.js'
import { enqueueOutbox } from '../sync/outbox.js'

type Tx = Prisma.TransactionClient
type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>

export interface Ctx {
  actor: Actor
}

// ---------------------------------------------------------------------------
// Input normalization + serialization
// ---------------------------------------------------------------------------

export interface OrderItemInput {
  menuItemId?: string
  id?: string // frontend cart key ("menuId" or "menuId::variant") — parsed if menuItemId absent
  variantLabel?: string | null
  name?: string
  price?: number | string
  qty?: number | string
  cost?: number | null
  costEstimated?: boolean | null
}

interface NormItem {
  menuItemId: string
  variantLabel: string | null
  name: string
  price: number
  qty: number
  cost: number | null
  costEstimated: boolean | null
}

// The frontend cart line keys on `id` = "menuId" or "menuId::variantLabel"; the
// OrderItem model splits that into two columns. Accept either an explicit
// menuItemId/variantLabel or a cart-key `id`, so this contract fits both a
// direct API caller and the eventual frontend swap unchanged.
function parseItem(it: OrderItemInput): NormItem | null {
  const rawKey = it.menuItemId ?? it.id ?? ''
  const [baseId, keyVariant] = String(rawKey).split('::')
  const menuItemId = String(baseId || '').trim()
  if (!menuItemId) return null
  const qty = Math.max(1, Math.round(Number(it.qty) || 0))
  return {
    menuItemId,
    variantLabel: it.variantLabel ?? keyVariant ?? null,
    name: String(it.name ?? ''),
    price: Math.round(Number(it.price) || 0),
    qty,
    cost: it.cost == null ? null : Math.round(Number(it.cost)),
    costEstimated: it.costEstimated ?? null,
  }
}

function cartKey(it: { menuItemId: string; variantLabel: string | null }): string {
  return it.variantLabel ? `${it.menuItemId}::${it.variantLabel}` : it.menuItemId
}

// Map a persisted order back to the object shape AppContext.jsx works with, so
// the Phase 6 frontend swap can drop these straight into existing state (nested
// cancellation/discount/complimentary objects reconstructed from flat columns).
export function serializeOrder(o: OrderWithItems) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    displayId: `ORD-${o.orderNumber}`,
    table: o.table,
    waiter: o.waiter,
    items: o.items.map((it) => ({
      id: cartKey(it), // cart key the frontend expects on order lines
      itemId: it.id, // DB row id, for precise qty edits
      menuItemId: it.menuItemId,
      variantLabel: it.variantLabel,
      name: it.name,
      price: it.price,
      qty: it.qty,
      addedAt: it.addedAt ? it.addedAt.toISOString() : undefined,
      cost: it.cost,
      costEstimated: it.costEstimated,
    })),
    payment: o.payment,
    method: o.method,
    onlineAccountId: o.onlineAccountId,
    onlineAccountName: o.onlineAccountName,
    onlineAccountType: o.onlineAccountType,
    gstRate: o.gstRate,
    kitchen: o.kitchen,
    shiftId: o.shiftId,
    createdAt: o.createdAt.toISOString(),
    cancelled: o.cancelled,
    materialLoss: o.materialLoss ?? undefined,
    cancellation: o.cancelled
      ? {
          reason: o.cancellationReason,
          notes: o.cancellationNotes,
          materialLoss: o.materialLoss ?? 0,
          by: o.cancellationBy,
          role: o.cancellationRole,
          at: o.cancellationAt?.toISOString(),
        }
      : undefined,
    discount:
      o.discountAmount != null
        ? {
            amount: o.discountAmount,
            reason: o.discountReason,
            notes: o.discountNotes,
            by: o.discountBy,
            role: o.discountRole,
            at: o.discountAt?.toISOString(),
          }
        : undefined,
    udhaarCustomerName: o.udhaarCustomerName ?? undefined,
    udhaarAccountId: o.udhaarAccountId ?? undefined,
    complimentary:
      o.payment === 'Complimentary'
        ? {
            reason: o.complimentaryReason,
            orderedBy: o.complimentaryOrderedBy,
            orderedByRole: o.complimentaryOrderedByRole,
            approvedBy: o.complimentaryApprovedBy,
            at: o.complimentaryAt?.toISOString(),
          }
        : undefined,
  }
}

// ---------------------------------------------------------------------------
// Shared helpers (inventory, shift, gst)
// ---------------------------------------------------------------------------

async function loadInventory(tx: Tx): Promise<InventoryItemLike[]> {
  const rows = await tx.inventoryItem.findMany()
  return rows.map((i) => ({ id: i.id, unit: i.unit, stock: i.stock, threshold: i.threshold, costPerUnit: i.costPerUnit }))
}

// Only approved recipes drive deduction/restock (calculateDeductions filters on
// status === 'approved'), so load just those with their ingredients.
async function loadApprovedRecipes(tx: Tx): Promise<RecipeLike[]> {
  const rows = await tx.recipe.findMany({ where: { status: 'approved' }, include: { ingredients: true } })
  return rows.map((r) => ({
    menuItemId: r.menuItemId,
    status: r.status,
    ingredients: r.ingredients.map((ing) => ({
      inventoryItemId: ing.inventoryItemId,
      itemName: ing.itemName,
      quantity: ing.quantity,
      unit: ing.unit,
    })),
  }))
}

// The single-drawer "active shift" an order/payment is attributed to. Multi
// device (Phase 2) may refine this per cashier; for now it's the one open
// drawer, matching the frontend's single global activeShift. Null before any
// shift exists.
async function getActiveShiftId(tx: Tx): Promise<string | null> {
  const s = await tx.shiftReconciliation.findFirst({ where: { status: 'active' }, orderBy: { shiftStartTime: 'desc' } })
  return s?.id ?? null
}

// Apply a set of stock changes (deduction: sign -1, restock: sign +1) with the
// same 3dp float-drift rounding + never-below-zero clamp as the frontend, then
// write the matching audit row. No-ops (and no audit) when there's nothing to
// change, mirroring the frontend's early return.
async function applyStockChanges(
  tx: Tx,
  inventory: InventoryItemLike[],
  changes: Record<string, DeductionEntry>,
  sign: 1 | -1,
  actor: Actor,
): Promise<void> {
  const entries = Object.entries(changes)
  if (entries.length === 0) return
  for (const [invId, d] of entries) {
    const inv = inventory.find((i) => i.id === invId)
    if (!inv) continue
    const next = Math.max(0, Math.round((inv.stock + sign * d.amount) * 1000) / 1000)
    await tx.inventoryItem.update({ where: { id: invId }, data: { stock: next } })
  }
  await writeAudit(tx, {
    action: sign < 0 ? 'INVENTORY_AUTO_DEDUCTED' : 'INVENTORY_RESTOCKED',
    actor,
    // Mirrors the frontend entry, which carries a field literally named
    // `details` holding the per-item array (writeAudit spreads this object into
    // the flat audit shape, so the key must stay `details`).
    details: {
      details: entries.map(([id, d]) => ({
        inventoryItemId: id,
        itemName: d.itemName,
        [sign < 0 ? 'deducted' : 'restocked']: d.amount,
        unit: d.unit,
      })),
    },
  })
}

async function deductForItems(tx: Tx, items: { menuItemId: string; qty: number }[], actor: Actor): Promise<void> {
  const inventory = await loadInventory(tx)
  const recipes = await loadApprovedRecipes(tx)
  await applyStockChanges(tx, inventory, calculateDeductions(items, inventory, recipes), -1, actor)
}

async function restockForItems(tx: Tx, items: { menuItemId: string; qty: number }[], actor: Actor): Promise<void> {
  const inventory = await loadInventory(tx)
  const recipes = await loadApprovedRecipes(tx)
  await applyStockChanges(tx, inventory, calculateRestocks(items, inventory, recipes), 1, actor)
}

// The gross bill total for an order, using its OWN locked gstRate — never the
// live setting, so an old order's total never shifts when GST is later changed.
function orderGross(o: OrderWithItems): number {
  return orderTotal(o.items.map((it) => ({ price: it.price, qty: it.qty })), 0, o.gstRate).total
}

async function fetchOrder(tx: Tx, id: string): Promise<OrderWithItems> {
  const o = await tx.order.findUnique({ where: { id }, include: { items: true } })
  if (!o) throw new NotFoundError('Order not found.')
  return o
}

function matchItem(o: OrderWithItems, key: string) {
  return o.items.find((it) => it.id === key || cartKey(it) === key)
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listOrders() {
  const rows = await prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } })
  return rows.map(serializeOrder)
}

export async function getOrder(id: string) {
  const o = await prisma.order.findUnique({ where: { id }, include: { items: true } })
  return o ? serializeOrder(o) : null
}

// ---------------------------------------------------------------------------
// Mutations (mirror AppContext.jsx)
// ---------------------------------------------------------------------------

export interface AddOrderInput {
  table: number | string
  waiter?: string | null
  items: OrderItemInput[]
  payment?: string
  method?: string
  onlineAccountId?: string | null
}

export async function addOrder(ctx: Ctx, input: AddOrderInput) {
  const items = (input.items ?? []).map(parseItem).filter((x): x is NormItem => x !== null)
  if (items.length === 0) throw new ServiceError('An order needs at least one item.')
  const table = Number(input.table)
  if (!Number.isFinite(table)) throw new ServiceError('A valid table is required.')

  return prisma.$transaction(async (tx) => {
    const settings = await tx.appSettings.findUnique({ where: { id: 'singleton' } })
    const gstRate = settings?.gstEnabled ? settings.gstRate : 0
    const shiftId = await getActiveShiftId(tx)

    const payment = input.payment ?? 'Unpaid'
    const paidOnline = payment === 'Paid' && input.method === 'Online'
    const account = paidOnline && input.onlineAccountId ? await tx.onlineAccount.findUnique({ where: { id: input.onlineAccountId } }) : null

    const orderNumber = await nextSequence(tx, 'order')
    const created = await tx.order.create({
      data: {
        orderNumber,
        table,
        waiter: input.waiter ?? null,
        payment,
        method: payment === 'Paid' ? input.method ?? '—' : '—',
        onlineAccountId: paidOnline ? account?.id ?? null : null,
        onlineAccountName: paidOnline ? account?.name ?? null : null,
        onlineAccountType: paidOnline ? account?.type ?? null : null,
        gstRate, // locked at creation
        kitchen: 'Pending',
        shiftId,
        items: {
          create: items.map((it) => ({
            menuItemId: it.menuItemId,
            variantLabel: it.variantLabel,
            name: it.name,
            price: it.price,
            qty: it.qty,
            cost: it.cost,
            costEstimated: it.costEstimated,
          })),
        },
      },
      include: { items: true },
    })

    // Auto-deduct approved-recipe ingredients once, at placement (matches the
    // frontend: the single creation point for both paid & unpaid orders).
    await deductForItems(tx, items.map((it) => ({ menuItemId: it.menuItemId, qty: it.qty })), ctx.actor)

    // Outbox stores the raw scalar row (`items` stripped), not the UI-shaped
    // serializeOrder() DTO — the VPS side does a plain prisma.order.upsert(),
    // which needs exactly the schema's own field shape, not a computed
    // displayId or the frontend's cart-key item format. Order items aren't
    // synced yet (see docs/05-phase-4-vps-sync.md's scope note on this).
    const { items: _orderItems, ...orderRow } = created
    await enqueueOutbox(tx, 'Order', created.id, orderRow)
    return serializeOrder(created)
  }).then((order) => {
    // No audit row for plain order placement (see broadcast.ts header) — this
    // is the one broadcast every other device's Tables/KDS screen depends on.
    broadcastEvent({ action: 'ORDER_PLACED', actor: ctx.actor, details: { orderId: order.id, table: order.table } })
    return order
  })
}

export async function appendOrderItems(ctx: Ctx, orderId: string, newItemsInput: OrderItemInput[]) {
  const newItems = (newItemsInput ?? []).map(parseItem).filter((x): x is NormItem => x !== null)
  if (newItems.length === 0) return null

  return prisma.$transaction(async (tx) => {
    const o = await fetchOrder(tx, orderId)
    if (o.cancelled || o.payment === 'Paid') throw new ServiceError('Cannot add items to a paid or cancelled order.')

    const stamp = new Date()
    for (const ni of newItems) {
      const existing = o.items.find((it) => it.menuItemId === ni.menuItemId && (it.variantLabel ?? null) === ni.variantLabel)
      if (existing) {
        await tx.orderItem.update({ where: { id: existing.id }, data: { qty: existing.qty + ni.qty } })
      } else {
        await tx.orderItem.create({
          data: {
            orderId,
            menuItemId: ni.menuItemId,
            variantLabel: ni.variantLabel,
            name: ni.name,
            price: ni.price,
            qty: ni.qty,
            cost: ni.cost,
            costEstimated: ni.costEstimated,
            addedAt: stamp,
          },
        })
      }
    }

    // Only the appended items deduct — the originals already did at placement.
    await deductForItems(tx, newItems.map((it) => ({ menuItemId: it.menuItemId, qty: it.qty })), ctx.actor)
    await writeAudit(tx, {
      action: 'ORDER_ITEMS_ADDED',
      actor: ctx.actor,
      at: stamp,
      details: { orderId, table: o.table, items: newItems.map((i) => `${i.name} ×${i.qty}`) },
    })

    return serializeOrder(await fetchOrder(tx, orderId))
  })
}

export async function markPaid(ctx: Ctx, orderId: string, method = 'Cash', onlineAccountId: string | null = null) {
  return prisma.$transaction(async (tx) => {
    const o = await fetchOrder(tx, orderId)
    const paidOnline = method === 'Online'
    const account = paidOnline && onlineAccountId ? await tx.onlineAccount.findUnique({ where: { id: onlineAccountId } }) : null
    // Attribute the cash to the shift open at payment time (an order placed
    // unpaid in an earlier shift may be settled in a later one).
    const shiftId = (await getActiveShiftId(tx)) ?? o.shiftId ?? null
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        payment: 'Paid',
        method,
        onlineAccountId: paidOnline ? account?.id ?? null : null,
        onlineAccountName: paidOnline ? account?.name ?? null : null,
        onlineAccountType: paidOnline ? account?.type ?? null : null,
        shiftId,
      },
      include: { items: true },
    })
    const { items: _orderItems, ...orderRow } = updated
    await enqueueOutbox(tx, 'Order', updated.id, orderRow)
    return serializeOrder(updated)
  }).then((order) => {
    broadcastEvent({ action: 'ORDER_PAID', actor: ctx.actor, details: { orderId: order.id, table: order.table } })
    return order
  })
}

export async function cancelOrder(ctx: Ctx, orderId: string, opts: { reason?: string; notes?: string } = {}) {
  const reason = opts.reason
  if (!reason) throw new ServiceError('A cancellation reason is required.')
  const notes = opts.notes ?? ''

  return prisma.$transaction(async (tx) => {
    const o = await fetchOrder(tx, orderId)
    if (o.payment !== 'Unpaid' || o.cancelled) throw new ServiceError('Only an unpaid order can be cancelled.')

    // Reusable items (cold drinks, bread, sides) are re-servable → restock, not
    // a loss. The rest were cooked-to-order → stay deducted, booked as loss.
    const menuIds = [...new Set(o.items.map((i) => i.menuItemId))]
    const menuItems = await tx.menuItem.findMany({ where: { id: { in: menuIds } } })
    const reusable = new Set(menuItems.filter((m) => m.reusable).map((m) => m.id))
    const asItems = o.items.map((i) => ({ menuItemId: i.menuItemId, qty: i.qty }))
    const reusableItems = asItems.filter((i) => reusable.has(i.menuItemId))
    const wastedItems = asItems.filter((i) => !reusable.has(i.menuItemId))

    const inventory = await loadInventory(tx)
    const recipes = await loadApprovedRecipes(tx)
    const materialLoss = Math.round(calculateOrderMaterialCost(wastedItems, inventory, recipes))
    if (reusableItems.length) {
      await applyStockChanges(tx, inventory, calculateRestocks(reusableItems, inventory, recipes), 1, ctx.actor)
    }

    const at = new Date()
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        cancelled: true,
        cancellationReason: reason,
        cancellationNotes: notes,
        cancellationBy: ctx.actor.name,
        cancellationRole: ctx.actor.role,
        cancellationAt: at,
        materialLoss,
      },
      include: { items: true },
    })
    await writeAudit(tx, { action: 'CANCELLED', actor: ctx.actor, at, details: { orderId, reason, notes, materialLoss } })
    const { items: _orderItems, ...orderRow } = updated
    await enqueueOutbox(tx, 'Order', updated.id, orderRow)
    return serializeOrder(updated)
  })
}

export async function updateOrderItemQty(ctx: Ctx, orderId: string, itemKey: string, newQty: number | string) {
  return prisma.$transaction(async (tx) => {
    const o = await fetchOrder(tx, orderId)
    if (o.cancelled || o.payment === 'Paid') throw new ServiceError('Cannot edit a paid or cancelled order.')
    const item = matchItem(o, itemKey)
    if (!item) throw new NotFoundError('Order line not found.')

    const nq = Math.max(0, Math.round(Number(newQty) || 0))
    if (item.qty === nq) return serializeOrder(o)
    const diff = nq - item.qty

    await tx.orderItem.update({ where: { id: item.id }, data: { qty: nq } })
    if (diff > 0) await deductForItems(tx, [{ menuItemId: item.menuItemId, qty: diff }], ctx.actor)
    else await restockForItems(tx, [{ menuItemId: item.menuItemId, qty: Math.abs(diff) }], ctx.actor)

    await writeAudit(tx, {
      action: 'ORDER_QTY_UPDATED',
      actor: ctx.actor,
      details: { orderId, itemId: item.id, itemName: item.name, oldQty: item.qty, newQty: nq },
    })
    return serializeOrder(await fetchOrder(tx, orderId))
  })
}

export async function applyDiscount(ctx: Ctx, orderId: string, opts: { amount?: number | string; reason?: string; notes?: string } = {}) {
  return prisma.$transaction(async (tx) => {
    const o = await fetchOrder(tx, orderId)
    if (o.cancelled) throw new ServiceError('Cannot discount a cancelled order.')
    const total = orderGross(o) // gross bill before any discount
    const amt = Math.min(Math.max(0, Number(opts.amount) || 0), total)
    if (amt <= 0) throw new ServiceError('Enter a discount amount greater than zero.')
    const reason = opts.reason || 'Manual Discount'
    const notes = opts.notes ?? ''
    const at = new Date()
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { discountAmount: amt, discountReason: reason, discountNotes: notes, discountBy: ctx.actor.name, discountRole: ctx.actor.role, discountAt: at },
      include: { items: true },
    })
    await writeAudit(tx, { action: 'DISCOUNT', actor: ctx.actor, at, details: { orderId, amount: amt, reason, notes } })
    return serializeOrder(updated)
  })
}

export async function removeDiscount(ctx: Ctx, orderId: string) {
  return prisma.$transaction(async (tx) => {
    const o = await fetchOrder(tx, orderId)
    if (o.discountAmount == null) throw new ServiceError('This order has no discount to remove.')
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { discountAmount: null, discountReason: null, discountNotes: null, discountBy: null, discountRole: null, discountAt: null },
      include: { items: true },
    })
    await writeAudit(tx, { action: 'DISCOUNT_REMOVED', actor: ctx.actor, details: { orderId } })
    return serializeOrder(updated)
  })
}

export async function markOrderUdhaar(ctx: Ctx, orderId: string, opts: { accountId?: string; customerName?: string } = {}) {
  return prisma.$transaction(async (tx) => {
    const o = await fetchOrder(tx, orderId)
    if (o.cancelled) throw new NotFoundError('Order not found.')
    if (o.payment !== 'Unpaid') throw new ServiceError('Only unpaid orders can be put on account.')
    const amount = orderGross(o)
    if (amount <= 0) throw new ServiceError('Order total is zero.')
    const at = new Date()

    let account = opts.accountId
      ? await tx.receivable.findFirst({ where: { id: opts.accountId, status: { not: 'settled' } } })
      : null
    const name = account ? account.name : String(opts.customerName ?? '').trim()
    if (!account && !name) throw new ServiceError('Customer name is required.')

    if (account) {
      await tx.receivable.update({
        where: { id: account.id },
        data: { balance: account.balance + amount, status: 'open', ledger: { create: { type: 'charge', amount, orderId, by: ctx.actor.name, at } } },
      })
    } else {
      account = await tx.receivable.create({
        data: {
          name,
          type: 'customer',
          balance: amount,
          status: 'open',
          notes: 'On-account from order',
          ledger: { create: { type: 'charge', amount, orderId, by: ctx.actor.name, at } },
        },
      })
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { payment: 'Udhaar', method: 'Udhaar', udhaarCustomerName: name, udhaarAccountId: account.id, udhaarAt: at, udhaarBy: ctx.actor.name },
      include: { items: true },
    })
    await writeAudit(tx, { action: 'ORDER_UDHAAR', actor: ctx.actor, at, details: { orderId, amount, account: name } })
    return { order: serializeOrder(updated), accountId: account.id }
  })
}

export async function markOrderComplimentary(ctx: Ctx, orderId: string, opts: { orderedBy?: string; reason?: string; notes?: string } = {}) {
  const who = String(opts.orderedBy ?? '').trim()
  if (!who) throw new ServiceError('Enter who authorised the free order.')

  return prisma.$transaction(async (tx) => {
    const o = await fetchOrder(tx, orderId)
    if (o.cancelled) throw new NotFoundError('Order not found.')
    if (o.payment !== 'Unpaid') throw new ServiceError('Only unpaid orders can be made complimentary.')
    const amount = orderGross(o)
    const at = new Date()
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        payment: 'Complimentary',
        method: 'Free',
        complimentaryReason: opts.reason ?? '',
        complimentaryOrderedBy: who,
        complimentaryOrderedByRole: ctx.actor.role,
        complimentaryApprovedBy: ctx.actor.name,
        complimentaryAt: at,
        complimentaryBy: ctx.actor.name,
      },
      include: { items: true },
    })
    await writeAudit(tx, { action: 'ORDER_COMPLIMENTARY', actor: ctx.actor, at, details: { orderId, amount, orderedBy: who, reason: opts.reason ?? '' } })
    return serializeOrder(updated)
  })
}

export async function markReady(ctx: Ctx, orderId: string) {
  const updated = await prisma.order.update({ where: { id: orderId }, data: { kitchen: 'Ready' }, include: { items: true } })
  broadcastEvent({ action: 'ORDER_READY', actor: ctx.actor, details: { orderId, table: updated.table } })
  return serializeOrder(updated)
}

export async function clearKitchen(ctx: Ctx, orderId: string) {
  const updated = await prisma.order.update({ where: { id: orderId }, data: { kitchen: 'Served' }, include: { items: true } })
  broadcastEvent({ action: 'ORDER_SERVED', actor: ctx.actor, details: { orderId, table: updated.table } })
  return serializeOrder(updated)
}
