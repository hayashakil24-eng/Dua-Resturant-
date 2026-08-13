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
  type OrderItemLike,
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
  // Raw, unclamped here — a whole-number-vs-decimal-weight rule depends on the
  // menu item's own `unit`, which isn't known synchronously. resolveUnits()
  // applies the real rounding/validation once it's loaded that inside the
  // transaction.
  const qty = Math.max(0, Number(it.qty) || 0)
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

// Smallest weight a kg-billed line can carry — guards against an accidental
// near-zero tap producing a line that's effectively free.
const MIN_KG_QTY = 0.05

function roundKg(n: number): number {
  return Math.round(n * 100) / 100
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
    deliveryRiderName: o.deliveryRiderName ?? undefined,
    deliveryCustomerName: o.deliveryCustomerName ?? undefined,
    deliveryCharge: o.deliveryCharge ?? undefined,
    deliveryPhone: o.deliveryPhone ?? undefined,
    deliveryAddress: o.deliveryAddress ?? undefined,
    deliveryInstructions: o.deliveryInstructions ?? undefined,
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
      // The frontend re-derives deductions locally (Reports' consumption
      // projection, Closing, the POS shortfall check), so the portion snapshot
      // has to travel with the line or those all read a whole portion.
      portion: it.portion,
      ready: it.ready,
      cancelled: it.cancelled,
      cancellation: it.cancelled
        ? {
            reason: it.cancellationReason,
            notes: it.cancellationNotes,
            materialLoss: it.materialLoss ?? 0,
            by: it.cancellationBy,
            role: it.cancellationRole,
            at: it.cancellationAt?.toISOString(),
          }
        : undefined,
    })),
    payment: o.payment,
    method: o.method,
    onlineAccountId: o.onlineAccountId,
    onlineAccountName: o.onlineAccountName,
    onlineAccountType: o.onlineAccountType,
    onlineAccountBank: o.onlineAccountBank,
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
            percent: o.discountPercent ?? undefined,
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

async function deductForItems(tx: Tx, items: OrderItemLike[], actor: Actor): Promise<void> {
  const inventory = await loadInventory(tx)
  const recipes = await loadApprovedRecipes(tx)
  await applyStockChanges(tx, inventory, calculateDeductions(items, inventory, recipes), -1, actor)
}

async function restockForItems(tx: Tx, items: OrderItemLike[], actor: Actor): Promise<void> {
  const inventory = await loadInventory(tx)
  const recipes = await loadApprovedRecipes(tx)
  await applyStockChanges(tx, inventory, calculateRestocks(items, inventory, recipes), 1, actor)
}

// Round/validate each incoming line's qty against its own menu item's billing
// unit — "pcs" (default) keeps the historical whole-number-servings rule,
// "kg" (Karahi/Handi/BBQ-by-weight) allows a decimal weight instead. Read
// server-side (never trust a client-supplied unit) for the same reason
// resolvePortions doesn't trust a client-supplied portion.
async function resolveUnits(tx: Tx, items: NormItem[]): Promise<NormItem[]> {
  const ids = [...new Set(items.map((i) => i.menuItemId))]
  const rows = await tx.menuItem.findMany({ where: { id: { in: ids } }, select: { id: true, unit: true } })
  const unitById = new Map(rows.map((r) => [r.id, r.unit]))
  return items.map((it) => {
    const unit = unitById.get(it.menuItemId) ?? 'pcs'
    if (unit === 'kg') {
      const qty = roundKg(it.qty)
      if (qty < MIN_KG_QTY) throw new ServiceError(`${it.name || 'Item'} must be at least ${MIN_KG_QTY}kg.`)
      // Weight billing replaces variant sizing — a stray variantLabel from a
      // stale client cart key is dropped rather than trusted.
      return { ...it, qty, variantLabel: null }
    }
    return { ...it, qty: Math.max(1, Math.round(it.qty)) }
  })
}

// Resolve each incoming line's portion from its variant row. Deliberately read
// server-side instead of trusting a `portion` in the request body: this number
// scales how much stock leaves inventory, so a stale or tampered client must
// not be able to set it. Lines with no variant are whole portions.
async function resolvePortions(tx: Tx, items: NormItem[]): Promise<(NormItem & { portion: number })[]> {
  const labelled = items.filter((i) => i.variantLabel)
  if (labelled.length === 0) return items.map((i) => ({ ...i, portion: 1 }))
  const rows = await tx.menuItemVariant.findMany({
    where: { OR: labelled.map((i) => ({ menuItemId: i.menuItemId, label: i.variantLabel as string })) },
  })
  const byKey = new Map(rows.map((r) => [`${r.menuItemId}::${r.label}`, r.portion]))
  return items.map((i) => ({
    ...i,
    // A variant the menu no longer has (renamed/deleted mid-order) falls back
    // to a whole portion rather than skipping the deduction entirely.
    portion: (i.variantLabel ? byKey.get(`${i.menuItemId}::${i.variantLabel}`) : 1) ?? 1,
  }))
}

// The gross bill total for an order, using its OWN locked gstRate — never the
// live setting, so an old order's total never shifts when GST is later changed.
// Cancelled lines are excluded (orderTotal filters on `cancelled`) so a
// single item pulled off a running bill actually reduces what's owed.
function orderGross(o: OrderWithItems): number {
  return orderTotal(o.items.map((it) => ({ price: it.price, qty: it.qty, cancelled: it.cancelled })), 0, o.gstRate).total
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
  deliveryRiderName?: string | null
  deliveryCustomerName?: string | null
  deliveryCharge?: number | null
  deliveryPhone?: string | null
  deliveryAddress?: string | null
  deliveryInstructions?: string | null
}

export async function addOrder(ctx: Ctx, input: AddOrderInput) {
  const items = (input.items ?? []).map(parseItem).filter((x): x is NormItem => x !== null)
  if (items.length === 0) throw new ServiceError('An order needs at least one item.')
  const table = Number(input.table)
  if (!Number.isFinite(table)) throw new ServiceError('A valid table is required.')

  return prisma.$transaction(async (tx) => {
    // One running order per physical table (matches the POS UI gate). A table
    // that already holds an Unpaid, non-cancelled order can't take a second
    // separate order — add to the existing one instead. Delivery/Takeaway
    // pseudo-tables (orderType set) are exempt: they carry many concurrent
    // orders by design. Server-side so two devices can't both open the same
    // table at once (the frontend check alone can't catch that race).
    const tableRow = await tx.table.findUnique({ where: { id: table } })
    if (tableRow && !tableRow.orderType) {
      const running = await tx.order.findFirst({ where: { table, payment: 'Unpaid', cancelled: false } })
      if (running) throw new ServiceError(`Table already has a running order (ORD-${running.orderNumber}) — add to it or settle it first.`)
    }

    // Delivery details are collected up front in the POS modal — re-checked
    // here (not just in the UI) same as every other mutator in this service.
    const isDelivery = tableRow?.orderType === 'delivery'
    if (isDelivery) {
      if (!input.deliveryRiderName?.trim()) throw new ServiceError('Rider name is required for a delivery order.')
      if (!input.deliveryCustomerName?.trim()) throw new ServiceError('Customer name is required for a delivery order.')
      if (!input.deliveryPhone?.trim()) throw new ServiceError('Customer phone is required for a delivery order.')
      if (!input.deliveryAddress?.trim()) throw new ServiceError('Delivery address is required for a delivery order.')
      if (input.deliveryCharge == null || !Number.isFinite(Number(input.deliveryCharge))) {
        throw new ServiceError('Delivery charge is required for a delivery order.')
      }
    }

    const settings = await tx.appSettings.findUnique({ where: { id: 'singleton' } })
    const gstRate = settings?.gstEnabled ? settings.gstRate : 0
    const shiftId = await getActiveShiftId(tx)

    const payment = input.payment ?? 'Unpaid'
    const paidOnline = payment === 'Paid' && input.method === 'Online'
    const account = paidOnline && input.onlineAccountId ? await tx.onlineAccount.findUnique({ where: { id: input.onlineAccountId } }) : null

    const orderNumber = await nextSequence(tx, 'order')
    const unitItems = await resolveUnits(tx, items)
    const lines = await resolvePortions(tx, unitItems)
    const created = await tx.order.create({
      data: {
        orderNumber,
        table,
        waiter: input.waiter ?? null,
        deliveryRiderName: isDelivery ? input.deliveryRiderName?.trim() : null,
        deliveryCustomerName: isDelivery ? input.deliveryCustomerName?.trim() : null,
        deliveryCharge: isDelivery ? Number(input.deliveryCharge) : null,
        deliveryPhone: isDelivery ? input.deliveryPhone?.trim() : null,
        deliveryAddress: isDelivery ? input.deliveryAddress?.trim() : null,
        deliveryInstructions: isDelivery ? input.deliveryInstructions?.trim() || null : null,
        payment,
        method: payment === 'Paid' ? input.method ?? '—' : '—',
        onlineAccountId: paidOnline ? account?.id ?? null : null,
        onlineAccountName: paidOnline ? account?.name ?? null : null,
        onlineAccountType: paidOnline ? account?.type ?? null : null,
        onlineAccountBank: paidOnline ? account?.bankName ?? null : null,
        gstRate, // locked at creation
        kitchen: 'Pending',
        shiftId,
        items: {
          create: lines.map((it) => ({
            menuItemId: it.menuItemId,
            variantLabel: it.variantLabel,
            name: it.name,
            price: it.price,
            qty: it.qty,
            cost: it.cost,
            costEstimated: it.costEstimated,
            portion: it.portion,
          })),
        },
      },
      include: { items: true },
    })

    // Auto-deduct approved-recipe ingredients once, at placement (matches the
    // frontend: the single creation point for both paid & unpaid orders).
    await deductForItems(tx, lines.map((it) => ({ menuItemId: it.menuItemId, qty: it.qty, portion: it.portion })), ctx.actor)

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
    const unitItems = await resolveUnits(tx, newItems)
    const newLines = await resolvePortions(tx, unitItems)
    for (const ni of newLines) {
      // Excludes cancelled rows so re-adding an item after a partial cancel
      // merges into the still-active remaining line, not a cancelled split-off.
      const existing = o.items.find((it) => !it.cancelled && it.menuItemId === ni.menuItemId && (it.variantLabel ?? null) === ni.variantLabel)
      if (existing) {
        // Merging into an existing line keeps that line's original portion
        // snapshot — same variant, so it is the same number by construction.
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
            portion: ni.portion,
            addedAt: stamp,
          },
        })
      }
    }

    // Only the appended items deduct — the originals already did at placement.
    await deductForItems(tx, newLines.map((it) => ({ menuItemId: it.menuItemId, qty: it.qty, portion: it.portion })), ctx.actor)
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
        onlineAccountBank: paidOnline ? account?.bankName ?? null : null,
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

export async function cancelOrder(ctx: Ctx, orderId: string, opts: { reason?: string; notes?: string; cooked?: boolean } = {}) {
  const reason = opts.reason
  if (!reason) throw new ServiceError('A cancellation reason is required.')
  const notes = opts.notes ?? ''

  return prisma.$transaction(async (tx) => {
    const o = await fetchOrder(tx, orderId)
    if (o.payment !== 'Unpaid' || o.cancelled) throw new ServiceError('Only an unpaid order can be cancelled.')

    // "cooked" decides whether ingredients were actually wasted. Defaults to the
    // order's live ready state (marked on the KDS), but the Cancel modal can set
    // it explicitly via "Mark as Ready". Not cooked → nothing was wasted, so
    // restock EVERYTHING and book no loss.
    const cooked = opts.cooked ?? o.kitchen === 'Ready'

    // Reusable items (cold drinks, bread, sides) are re-servable → restock, not
    // a loss. Cooked-to-order items are a loss ONLY if the dish was cooked;
    // otherwise they restock too.
    const menuIds = [...new Set(o.items.map((i) => i.menuItemId))]
    const menuItems = await tx.menuItem.findMany({ where: { id: { in: menuIds } } })
    const reusable = new Set(menuItems.filter((m) => m.reusable).map((m) => m.id))
    // Restock/write-off using each line's OWN portion snapshot, so a cancel
    // returns exactly what placement took — even if the variant's portion was
    // edited in the menu after the order was punched.
    const asItems = o.items.map((i) => ({ menuItemId: i.menuItemId, qty: i.qty, portion: i.portion }))
    const wastedItems = cooked ? asItems.filter((i) => !reusable.has(i.menuItemId)) : []
    const restockItems = cooked ? asItems.filter((i) => reusable.has(i.menuItemId)) : asItems

    const inventory = await loadInventory(tx)
    const recipes = await loadApprovedRecipes(tx)
    const materialLoss = Math.round(calculateOrderMaterialCost(wastedItems, inventory, recipes))
    if (restockItems.length) {
      await applyStockChanges(tx, inventory, calculateRestocks(restockItems, inventory, recipes), 1, ctx.actor)
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

    const menuItem = await tx.menuItem.findUnique({ where: { id: item.menuItemId } })
    const raw = Math.max(0, Number(newQty) || 0)
    const nq = menuItem?.unit === 'kg' ? roundKg(raw) : Math.round(raw)
    if (item.qty === nq) return serializeOrder(o)
    const diff = nq - item.qty

    await tx.orderItem.update({ where: { id: item.id }, data: { qty: nq } })
    if (diff > 0) await deductForItems(tx, [{ menuItemId: item.menuItemId, qty: diff, portion: item.portion }], ctx.actor)
    else await restockForItems(tx, [{ menuItemId: item.menuItemId, qty: Math.abs(diff), portion: item.portion }], ctx.actor)

    await writeAudit(tx, {
      action: 'ORDER_QTY_UPDATED',
      actor: ctx.actor,
      details: { orderId, itemId: item.id, itemName: item.name, oldQty: item.qty, newQty: nq },
    })
    return serializeOrder(await fetchOrder(tx, orderId))
  })
}

// Cancel ONE line off an otherwise-running (unpaid) bill — e.g. the customer
// sends back a dish. A line-level sibling of cancelOrder (same reusable/cooked
// material-loss-vs-restock branching), but scoped to a single OrderItem and
// never touches the order's own `cancelled`/`payment` state: the rest of the
// bill keeps going. The item itself is never removed (see matchItem/`items`
// convention) — only flagged, same as a whole-order cancel.
//
// opts.qty lets the caller cancel only PART of the line's current quantity
// (e.g. 1 of 3). Omitting it (or passing the full remaining qty) cancels the
// whole row exactly as before — that all-or-nothing path is untouched, so
// existing callers/behavior are unaffected. A true partial cancel instead
// shrinks this row to what's left (still active) and inserts a cloned row
// carrying just the cancelled quantity, struck through — the same "never
// hard-delete, just flag" convention a full cancel already uses, just split
// across two rows instead of one.
export async function cancelOrderItem(ctx: Ctx, orderId: string, itemKey: string, opts: { reason?: string; notes?: string; cooked?: boolean; qty?: number } = {}) {
  const reason = opts.reason
  if (!reason) throw new ServiceError('A cancellation reason is required.')
  const notes = opts.notes ?? ''

  return prisma.$transaction(async (tx) => {
    const o = await fetchOrder(tx, orderId)
    if (o.cancelled || o.payment !== 'Unpaid') throw new ServiceError('Only a running (unpaid) order\'s items can be cancelled.')
    const item = matchItem(o, itemKey)
    if (!item) throw new NotFoundError('Order line not found.')
    if (item.cancelled) throw new ServiceError('This item is already cancelled.')

    const menuItem = await tx.menuItem.findUnique({ where: { id: item.menuItemId } })
    const isKg = menuItem?.unit === 'kg'
    const rawRequested = opts.qty == null ? item.qty : Number(opts.qty)
    // A kg-billed line can be cancelled by an arbitrary decimal weight (e.g.
    // 0.5kg out of a 1.5kg line); a pcs line keeps the historical
    // whole-number-only rule.
    const requestedQty = isKg ? roundKg(rawRequested) : rawRequested
    if (isKg ? !(requestedQty > 0) : !Number.isInteger(requestedQty) || requestedQty <= 0) {
      throw new ServiceError(isKg ? 'Weight to cancel must be greater than 0kg.' : 'Quantity to cancel must be a whole number of at least 1.')
    }
    if (requestedQty > item.qty + 1e-9) {
      throw new ServiceError('Cannot cancel more than the remaining quantity.')
    }

    // Same "was it actually cooked" question as cancelOrder, but read from
    // this line's OWN per-item KDS ready flag rather than the whole order's —
    // a more precise signal than cancelOrder gets, since one line can be
    // ready while its siblings aren't. The modal can still override via
    // opts.cooked (its own "Mark as Cooked" toggle), same UX as cancelOrder.
    const cooked = opts.cooked ?? item.ready
    const reusable = menuItem?.reusable ?? false
    const wasted = cooked && !reusable
    const asItems = [{ menuItemId: item.menuItemId, qty: requestedQty, portion: item.portion }]

    const inventory = await loadInventory(tx)
    const recipes = await loadApprovedRecipes(tx)
    let materialLoss = 0
    if (wasted) {
      materialLoss = Math.round(calculateOrderMaterialCost(asItems, inventory, recipes))
    } else {
      await applyStockChanges(tx, inventory, calculateRestocks(asItems, inventory, recipes), 1, ctx.actor)
    }

    const at = new Date()
    const remainingQty = isKg ? roundKg(item.qty - requestedQty) : item.qty - requestedQty
    if (remainingQty > 0) {
      await tx.orderItem.update({ where: { id: item.id }, data: { qty: remainingQty } })
      await tx.orderItem.create({
        data: {
          orderId,
          menuItemId: item.menuItemId,
          variantLabel: item.variantLabel,
          name: item.name,
          price: item.price,
          qty: requestedQty,
          cost: item.cost,
          costEstimated: item.costEstimated,
          portion: item.portion,
          ready: item.ready,
          cancelled: true,
          cancellationReason: reason,
          cancellationNotes: notes,
          cancellationBy: ctx.actor.name,
          cancellationRole: ctx.actor.role,
          cancellationAt: at,
          materialLoss: materialLoss || null,
        },
      })
    } else {
      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          cancelled: true,
          cancellationReason: reason,
          cancellationNotes: notes,
          cancellationBy: ctx.actor.name,
          cancellationRole: ctx.actor.role,
          cancellationAt: at,
          materialLoss: materialLoss || null,
        },
      })
    }

    await writeAudit(tx, {
      action: 'ORDER_ITEM_CANCELLED',
      actor: ctx.actor,
      at,
      details: {
        orderId,
        orderNumber: o.orderNumber,
        itemId: item.id,
        itemName: item.name,
        originalQty: item.qty,
        cancelledQty: requestedQty,
        remainingQty,
        reason,
        notes,
        materialLoss,
      },
    })

    // If that was the last active line, the order itself has nothing left to
    // collect — without this it stays "Unpaid" at a Rs. 0 total forever, which
    // surfaced Mark as Paid/Udhaar/Complimentary on a bill with nothing on it.
    // Stock/loss were already applied per-line above, so this only flips the
    // order's own status fields (mirrors cancelOrder's data shape) — no second
    // restock pass.
    const remainingItems = await tx.orderItem.findMany({ where: { orderId } })
    if (remainingItems.every((it) => it.cancelled)) {
      const totalMaterialLoss = remainingItems.reduce((s, it) => s + (it.materialLoss || 0), 0)
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          cancelled: true,
          cancellationReason: reason,
          cancellationNotes: notes,
          cancellationBy: ctx.actor.name,
          cancellationRole: ctx.actor.role,
          cancellationAt: at,
          materialLoss: totalMaterialLoss || null,
        },
        include: { items: true },
      })
      const { items: _orderItems, ...orderRow } = updatedOrder
      await enqueueOutbox(tx, 'Order', updatedOrder.id, orderRow)
      await writeAudit(tx, {
        action: 'CANCELLED',
        actor: ctx.actor,
        at,
        details: { orderId, orderNumber: o.orderNumber, reason, notes, materialLoss: totalMaterialLoss },
      })
    }

    return serializeOrder(await fetchOrder(tx, orderId))
  })
}

// Move a running order to a different table (e.g. the party physically moved
// seats after ordering). A pure re-seat: nothing about money/inventory changes,
// only the `table` column — so it's a lightweight status-transition-style edit,
// not a cancel-and-recreate. Blocked once the bill is settled/cancelled so a
// closed order's table can never be silently rewritten.
export async function shiftOrderTable(ctx: Ctx, orderId: string, newTable: number | string) {
  const table = Number(newTable)
  if (!Number.isFinite(table)) throw new ServiceError('A valid destination table is required.')

  return prisma.$transaction(async (tx) => {
    const o = await fetchOrder(tx, orderId)
    if (o.cancelled || o.payment !== 'Unpaid') throw new ServiceError('Only a running (unpaid) order can be moved to another table.')
    if (o.table === table) throw new ServiceError('The order is already on this table.')
    const dest = await tx.table.findUnique({ where: { id: table } })
    if (!dest) throw new NotFoundError('Destination table not found.')
    // An occupied table is never a valid destination: two unpaid orders sharing
    // one seat is a billing mix-up, not a merge. Checked here and not only in
    // the picker, since two cashiers can pick the same free table at once.
    // Delivery/Takeaway (dest.orderType set) are seatless pseudo-tables meant to
    // hold many concurrent orders — exempt, matching POS.jsx's selectedTableBusy.
    if (!dest.orderType) {
      const busy = await tx.order.findFirst({ where: { table, cancelled: false, payment: 'Unpaid', id: { not: orderId } } })
      if (busy) throw new ServiceError('That table already has a running order — pick a free table.')
    }

    const from = o.table
    const at = new Date()
    const updated = await tx.order.update({ where: { id: orderId }, data: { table }, include: { items: true } })
    await writeAudit(tx, { action: 'ORDER_TABLE_SHIFTED', actor: ctx.actor, at, details: { orderId, from, to: table } })
    const { items: _orderItems, ...orderRow } = updated
    await enqueueOutbox(tx, 'Order', updated.id, orderRow)
    return serializeOrder(updated)
  })
}

export async function applyDiscount(
  ctx: Ctx,
  orderId: string,
  opts: { amount?: number | string; percent?: number | string; reason?: string; notes?: string } = {},
) {
  return prisma.$transaction(async (tx) => {
    const o = await fetchOrder(tx, orderId)
    if (o.cancelled) throw new ServiceError('Cannot discount a cancelled order.')
    const total = orderGross(o) // gross bill before any discount
    const rawPercent = opts.percent != null && String(opts.percent).trim() !== '' ? Number(opts.percent) : null

    let percent: number | null = null
    let amt: number
    if (rawPercent != null) {
      // Whole percents only: discountPercent is an Int and a receipt reading
      // "Discount (12.5%)" that doesn't reproduce the rupee figure exactly is
      // worse than not offering it.
      if (!Number.isInteger(rawPercent) || rawPercent <= 0 || rawPercent > 100) {
        throw new ServiceError('Discount percent must be a whole number between 1 and 100.')
      }
      percent = rawPercent
      // Recomputed here, never trusted from the client — the same reason every
      // permission is re-checked server-side.
      amt = Math.min(Math.round((total * percent) / 100), total)
    } else {
      amt = Math.min(Math.max(0, Number(opts.amount) || 0), total)
    }
    if (amt <= 0) throw new ServiceError('Enter a discount amount greater than zero.')

    // Cashier's `discount` permission is 'edit' (capped), not 'full' like
    // Admin/Manager — re-checked here, never trusted from the client, same as
    // every other figure in this function. Effective-percent-of-bill covers
    // both percent and flat-amount requests identically.
    if (ctx.actor.role === 'Cashier') {
      const { maxCashierDiscountPercent: cap } = await tx.appSettings.upsert({ where: { id: 'singleton' }, create: { id: 'singleton' }, update: {} })
      const effectivePercent = total > 0 ? (amt / total) * 100 : 0
      if (effectivePercent > cap + 0.01) {
        throw new ServiceError(
          cap > 0
            ? `Cashiers can discount up to ${cap}% — ask a Manager/Admin for more.`
            : 'Cashiers cannot apply a discount until an Admin sets a limit in Settings.',
        )
      }
    }

    const reason = opts.reason || 'Manual Discount'
    const notes = opts.notes ?? ''
    const at = new Date()
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { discountAmount: amt, discountPercent: percent, discountReason: reason, discountNotes: notes, discountBy: ctx.actor.name, discountRole: ctx.actor.role, discountAt: at },
      include: { items: true },
    })
    await writeAudit(tx, { action: 'DISCOUNT', actor: ctx.actor, at, details: { orderId, amount: amt, ...(percent != null ? { percent } : {}), reason, notes } })
    return serializeOrder(updated)
  })
}

export async function removeDiscount(ctx: Ctx, orderId: string) {
  return prisma.$transaction(async (tx) => {
    const o = await fetchOrder(tx, orderId)
    if (o.discountAmount == null) throw new ServiceError('This order has no discount to remove.')
    // Separation of duties: a Cashier can undo their own discount entry, but
    // not override one an Admin/Manager applied — same reasoning as the
    // Cashier discount-percent cap above, re-checked here (never trusted from
    // the client) since the UI's Remove button is hidden, not disabled.
    if (ctx.actor.role === 'Cashier' && o.discountRole !== 'Cashier') {
      throw new ServiceError('Only an Admin or Manager can remove this discount.')
    }
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { discountAmount: null, discountPercent: null, discountReason: null, discountNotes: null, discountBy: null, discountRole: null, discountAt: null },
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
  // Whole-order "mark all ready" — also flip every line ready so the per-item
  // KDS view stays consistent with the order-level flag.
  const updated = await prisma.$transaction(async (tx) => {
    await tx.orderItem.updateMany({ where: { orderId }, data: { ready: true } })
    return tx.order.update({ where: { id: orderId }, data: { kitchen: 'Ready' }, include: { items: true } })
  })
  broadcastEvent({ action: 'ORDER_READY', actor: ctx.actor, details: { orderId, table: updated.table } })
  return serializeOrder(updated)
}

// Toggle one line's ready state (KDS per-item ticking). The order auto-flips to
// 'Ready' once every line is ready, and back to 'Pending' if a ready order has a
// line un-ticked (a mis-tap is recoverable). No-op once the order is 'Served'.
export async function markItemReady(ctx: Ctx, orderId: string, itemId: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } })
    if (!order) throw new NotFoundError('Order not found.')
    if (order.kitchen === 'Served') return order
    const item = order.items.find((it) => it.id === itemId)
    if (!item) throw new NotFoundError('Order item not found.')
    await tx.orderItem.update({ where: { id: itemId }, data: { ready: !item.ready } })
    const allReady = order.items.every((it) => (it.id === itemId ? !item.ready : it.ready))
    const kitchen = allReady ? 'Ready' : 'Pending'
    return tx.order.update({ where: { id: orderId }, data: { kitchen }, include: { items: true } })
  })
  broadcastEvent({
    action: updated.kitchen === 'Ready' ? 'ORDER_READY' : 'ITEM_READY',
    actor: ctx.actor,
    details: { orderId, itemId, table: updated.table },
  })
  return serializeOrder(updated)
}

export async function clearKitchen(ctx: Ctx, orderId: string) {
  const updated = await prisma.order.update({ where: { id: orderId }, data: { kitchen: 'Served' }, include: { items: true } })
  broadcastEvent({ action: 'ORDER_SERVED', actor: ctx.actor, details: { orderId, table: updated.table } })
  return serializeOrder(updated)
}
