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

interface Ctx {
  actor: Actor
}

export async function listInventory() {
  return prisma.inventoryItem.findMany({ orderBy: { id: 'asc' } })
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
