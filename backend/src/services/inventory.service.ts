// Inventory items — port of AppContext.jsx's adjustStock / restock /
// addInventoryItem. The frontend didn't audit adjustStock/restock (only
// addInventoryItem); this backend DOES audit stock corrections/restocks,
// because ../../CLAUDE.md's audit convention requires an entry for anything
// that changes inventory and the backend is where that gap is meant to close
// structurally. Behavior (clamp at 0, dup-name reject, INV## id minting) is
// otherwise unchanged.

import { prisma } from '../db/client.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'
import { enqueueOutbox } from '../sync/outbox.js'
import { createLedgerEntry, PURCHASE_CATEGORY } from './accounting.service.js'

interface Ctx {
  actor: Actor
}

export async function listInventory() {
  return prisma.inventoryItem.findMany({ orderBy: { id: 'asc' } })
}

export async function listPurchases() {
  return prisma.stockPurchase.findMany({ orderBy: { date: 'desc' } })
}

// Next "INV##" id (max existing suffix + 1, zero-padded to 2), matching the
// frontend + seed convention so recipe ingredient references stay legible.
// Timestamp-style ids (if any ever exist) are ignored, same as the frontend.
async function nextInvId(): Promise<string> {
  const rows = await prisma.inventoryItem.findMany({ select: { id: true } })
  const maxNum = rows.reduce((max, r) => {
    const m = /^INV0*(\d+)$/.exec(r.id)
    return m ? Math.max(max, Number(m[1])) : max
  }, 0)
  return `INV${String(maxNum + 1).padStart(2, '0')}`
}

export async function adjustStock(ctx: Ctx, id: string, delta: number) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({ where: { id } })
    if (!item) throw new ServiceError('Inventory item not found.', 404)
    const next = Math.max(0, Math.round((item.stock + (Number(delta) || 0)) * 1000) / 1000)
    const updated = await tx.inventoryItem.update({ where: { id }, data: { stock: next } })
    await writeAudit(tx, {
      action: 'STOCK_ADJUSTED',
      actor: ctx.actor,
      details: { inventoryItemId: id, name: item.name, delta: Number(delta) || 0, from: item.stock, to: next },
    })
    await enqueueOutbox(tx, 'InventoryItem', updated.id, updated)
    return updated
  })
}

export async function restock(ctx: Ctx, id: string, amount = 10) {
  return adjustStock(ctx, id, Math.abs(Number(amount) || 0))
}

export interface PurchaseInput {
  quantity?: number
  unitCost?: number
  totalCost?: number
  supplier?: string
  date?: string
  // true (default, omitted = existing behavior) — cash left the drawer today,
  // books an expense immediately. false — bought on credit ("udhar"): no cash
  // moved yet, so instead of an expense this charges a supplier Payable
  // account, settled later via payables.service.ts's recordPayablePayment
  // (which is what actually mints the expense, on the day it's really paid).
  paid?: boolean
}

// Buying stock: raises the quantity AND books the money, so the purchase
// reaches every report through the normal ledger. Kept separate from
// adjustStock because that path also serves Admin *corrections* to a
// miscount, where no money moved — booking those as expenses would invent spend.
export async function recordPurchase(ctx: Ctx, id: string, input: PurchaseInput) {
  const quantity = Number(input.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) throw new ServiceError('Purchase quantity must be greater than zero.')

  const unitCost = Math.max(0, Number(input.unitCost) || 0)
  // Total wins when supplied — a real bill is rarely exactly qty × unit price
  // (rounding, delivery). Otherwise derive it.
  const totalCost = Math.round(
    Number.isFinite(Number(input.totalCost)) && Number(input.totalCost) > 0
      ? Number(input.totalCost)
      : quantity * unitCost,
  )
  if (totalCost <= 0) throw new ServiceError('Purchase cost must be greater than zero.')

  const date = input.date ? new Date(input.date) : new Date()
  if (Number.isNaN(date.getTime())) throw new ServiceError('A valid purchase date is required.')

  const paid = input.paid !== false
  const supplier = (input.supplier ?? '').trim() || null
  // Can't track "who it's owed to" without a name — the whole point of this path.
  if (!paid && !supplier) throw new ServiceError('Supplier name is required for a credit purchase.')

  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({ where: { id } })
    if (!item) throw new ServiceError('Inventory item not found.', 404)

    const nextStock = Math.round((item.stock + quantity) * 1000) / 1000
    // The latest purchase price becomes the item's cost — this is what recipe
    // costing reads, so leaving it stale would price recipes off an old bill.
    const effectiveUnitCost = unitCost > 0 ? unitCost : Math.round(totalCost / quantity)
    const updated = await tx.inventoryItem.update({
      where: { id },
      data: { stock: nextStock, costPerUnit: effectiveUnitCost },
    })

    const purchase = await tx.stockPurchase.create({
      data: {
        inventoryItemId: id,
        itemName: item.name,
        quantity,
        unit: item.unit,
        unitCost: effectiveUnitCost,
        totalCost,
        supplier,
        date,
        paymentStatus: paid ? 'paid' : 'unpaid',
        createdBy: ctx.actor.name,
        createdByRole: ctx.actor.role,
      },
    })

    let linked = purchase
    if (paid) {
      const txn = await createLedgerEntry(tx, {
        type: 'expense',
        category: PURCHASE_CATEGORY,
        description: `${item.name} — ${quantity} ${item.unit}`,
        amount: totalCost,
        date,
        source: 'purchase',
        sourceId: purchase.id,
      })
      linked = await tx.stockPurchase.update({ where: { id: purchase.id }, data: { transactionId: txn.id } })
    } else {
      // No cash moved — charge a supplier Payable account instead of an
      // expense, same shape as markOrderUdhaar charging a Receivable. Reopens
      // a settled account under the same name rather than fragmenting one
      // supplier's history across rows.
      const account = await tx.payable.findFirst({ where: { name: supplier as string, status: { not: 'settled' } } })
      const at = new Date()
      const payable = account
        ? await tx.payable.update({
            where: { id: account.id },
            data: { balance: account.balance + totalCost, status: 'open', ledger: { create: { type: 'purchase', amount: totalCost, purchaseId: purchase.id, by: ctx.actor.name, at } } },
          })
        : await tx.payable.create({
            data: {
              name: supplier as string,
              balance: totalCost,
              status: 'open',
              notes: 'Opened from a credit stock purchase',
              ledger: { create: { type: 'purchase', amount: totalCost, purchaseId: purchase.id, by: ctx.actor.name, at } },
            },
          })
      linked = await tx.stockPurchase.update({ where: { id: purchase.id }, data: { payableId: payable.id } })
      await enqueueOutbox(tx, 'Payable', payable.id, payable)
    }

    await writeAudit(tx, {
      action: 'STOCK_PURCHASED',
      actor: ctx.actor,
      details: { inventoryItemId: id, name: item.name, quantity, unit: item.unit, totalCost, from: item.stock, to: nextStock, paymentStatus: paid ? 'paid' : 'unpaid', supplier },
    })
    await enqueueOutbox(tx, 'InventoryItem', updated.id, updated)
    await enqueueOutbox(tx, 'StockPurchase', linked.id, linked)
    return { item: updated, purchase: linked }
  })
}

export interface AddInventoryInput {
  name?: string
  nameUr?: string
  category?: string
  unit?: string
  stock?: number
  threshold?: number
  costPerUnit?: number
}

export async function addInventoryItem(ctx: Ctx, input: AddInventoryInput) {
  const trimmed = (input.name ?? '').trim()
  if (!trimmed) throw new ServiceError('Item name is required.')

  return prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryItem.findFirst({ where: { name: { equals: trimmed } } })
    // SQLite's default collation is case-sensitive; do the case-insensitive
    // dedupe check in JS to match the frontend's toLowerCase() comparison.
    const all = await tx.inventoryItem.findMany({ select: { name: true } })
    if (existing || all.some((i) => i.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new ServiceError(`“${trimmed}” already exists in inventory.`)
    }
    const id = await nextInvId()
    const item = await tx.inventoryItem.create({
      data: {
        id,
        name: trimmed,
        nameUr: (input.nameUr ?? '').trim() || null,
        category: (input.category ?? 'Other').trim() || 'Other',
        stock: Math.max(0, Number(input.stock) || 0),
        unit: input.unit || 'kg',
        threshold: Math.max(0, Number(input.threshold) || 0),
        costPerUnit: Math.max(0, Number(input.costPerUnit) || 0),
        active: true,
      },
    })
    await writeAudit(tx, { action: 'INVENTORY_ITEM_CREATED', actor: ctx.actor, details: { inventoryItemId: id, name: item.name } })
    return item
  })
}
