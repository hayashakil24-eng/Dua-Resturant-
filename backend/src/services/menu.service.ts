// Menu, categories, and the shared "Most Ordered" list — port of
// AppContext.jsx's addMenuItem/updateMenuItem/deleteMenuItem/toggleMenuItem/
// replaceMenu, addCategory/deleteCategory, and toggleMostOrdered.
//
// The frontend didn't audit menu-item edits (only category + most-ordered
// changes), and that parity is kept here. Menu items keep their cuid primary
// key; only OrderItem.menuItemId references them and it's a plain string
// snapshot, so edits/deletes never break historical orders.

import type { Prisma } from '@prisma/client'
import { prisma } from '../db/client.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'

type Tx = Prisma.TransactionClient
interface Ctx {
  actor: Actor
}

// ---- Menu items -----------------------------------------------------------

export async function listMenu() {
  return prisma.menuItem.findMany({ include: { variants: true }, orderBy: { createdAt: 'asc' } })
}

export interface MenuItemInput {
  name?: string
  category?: string
  price?: number
  image?: string | null
  description?: string | null
  cost?: number | null
  costEstimated?: boolean
  reusable?: boolean
  active?: boolean
  variants?: { label: string; price: number; cost?: number | null; costEstimated?: boolean }[]
}

export async function addMenuItem(_ctx: Ctx, item: MenuItemInput) {
  const name = (item.name ?? '').trim()
  if (!name) throw new ServiceError('Menu item name is required.')
  return prisma.menuItem.create({
    data: {
      name,
      category: item.category || 'Other',
      price: Math.round(Number(item.price) || 0),
      image: item.image ?? null,
      description: item.description ?? null,
      cost: item.cost == null ? null : Math.round(Number(item.cost)),
      costEstimated: item.costEstimated ?? true,
      reusable: item.reusable ?? false,
      active: item.active ?? true,
      variants: item.variants?.length
        ? { create: item.variants.map((v) => ({ label: v.label, price: Math.round(Number(v.price) || 0), cost: v.cost == null ? null : Math.round(Number(v.cost)), costEstimated: v.costEstimated ?? true })) }
        : undefined,
    },
    include: { variants: true },
  })
}

export async function updateMenuItem(_ctx: Ctx, id: string, updates: MenuItemInput) {
  const { variants, ...scalar } = updates
  const data: Record<string, unknown> = {}
  if (scalar.name != null) data.name = String(scalar.name)
  if (scalar.category != null) data.category = scalar.category
  if (scalar.price != null) data.price = Math.round(Number(scalar.price) || 0)
  if ('image' in scalar) data.image = scalar.image ?? null
  if ('description' in scalar) data.description = scalar.description ?? null
  if ('cost' in scalar) data.cost = scalar.cost == null ? null : Math.round(Number(scalar.cost))
  if (scalar.costEstimated != null) data.costEstimated = scalar.costEstimated
  if (scalar.reusable != null) data.reusable = scalar.reusable
  if (scalar.active != null) data.active = scalar.active

  return prisma.$transaction(async (tx) => {
    // Replace variants wholesale when provided (mirrors the frontend's
    // spread-replace of the whole item), otherwise leave them untouched.
    if (variants) {
      await tx.menuItemVariant.deleteMany({ where: { menuItemId: id } })
      if (variants.length) {
        await tx.menuItemVariant.createMany({
          data: variants.map((v) => ({ menuItemId: id, label: v.label, price: Math.round(Number(v.price) || 0), cost: v.cost == null ? null : Math.round(Number(v.cost)), costEstimated: v.costEstimated ?? true })),
        })
      }
    }
    return tx.menuItem.update({ where: { id }, data, include: { variants: true } })
  })
}

export async function deleteMenuItem(_ctx: Ctx, id: string) {
  await prisma.menuItem.delete({ where: { id } })
  return { success: true }
}

export async function toggleMenuItem(_ctx: Ctx, id: string) {
  const item = await prisma.menuItem.findUnique({ where: { id } })
  if (!item) throw new ServiceError('Menu item not found.', 404)
  return prisma.menuItem.update({ where: { id }, data: { active: !item.active }, include: { variants: true } })
}

// Replace the entire menu (import). Destructive: cascades to variants/recipes
// for removed items, same net effect as the frontend's setMenu(items).
export async function replaceMenu(_ctx: Ctx, items: MenuItemInput[]) {
  return prisma.$transaction(async (tx) => {
    await tx.menuItem.deleteMany()
    for (const item of items) {
      await tx.menuItem.create({
        data: {
          name: (item.name ?? '').trim() || 'Unnamed',
          category: item.category || 'Other',
          price: Math.round(Number(item.price) || 0),
          image: item.image ?? null,
          description: item.description ?? null,
          cost: item.cost == null ? null : Math.round(Number(item.cost)),
          costEstimated: item.costEstimated ?? true,
          reusable: item.reusable ?? false,
          active: item.active ?? true,
          // Was previously missing entirely — a bulk replace silently
          // dropped every item's variants (e.g. Steaks Beef/Chicken, Pizza
          // S/M/L), unlike addMenuItem above which already handles this.
          variants: item.variants?.length
            ? { create: item.variants.map((v) => ({ label: v.label, price: Math.round(Number(v.price) || 0), cost: v.cost == null ? null : Math.round(Number(v.cost)), costEstimated: v.costEstimated ?? true })) }
            : undefined,
        },
      })
    }
    return tx.menuItem.findMany({ include: { variants: true } })
  })
}

// ---- Categories -----------------------------------------------------------

// All category names in use: those on menu items plus free-text custom ones.
export async function listCategories() {
  const [items, custom] = await Promise.all([
    prisma.menuItem.findMany({ select: { category: true }, distinct: ['category'] }),
    prisma.category.findMany({ orderBy: { createdAt: 'asc' } }),
  ])
  const names = new Set<string>()
  items.forEach((i) => names.add(i.category))
  custom.forEach((c) => names.add(c.name))
  return [...names]
}

export async function addCategory(ctx: Ctx, name: string) {
  const trimmed = (name ?? '').trim()
  if (!trimmed) throw new ServiceError('Category name cannot be empty.')
  return prisma.$transaction(async (tx) => {
    const existing = await categoriesIn(tx)
    if (existing.some((c) => c.toLowerCase() === trimmed.toLowerCase())) throw new ServiceError('This category already exists.')
    await tx.category.create({ data: { name: trimmed, createdBy: ctx.actor.name } })
    await writeAudit(tx, { action: 'CATEGORY_ADDED', actor: ctx.actor, details: { category: trimmed } })
    return { success: true }
  })
}

export async function deleteCategory(ctx: Ctx, name: string) {
  return prisma.$transaction(async (tx) => {
    const inUse = await tx.menuItem.count({ where: { category: { equals: name } } })
    if (inUse > 0) {
      throw new ServiceError(`Cannot delete — ${inUse} item${inUse > 1 ? 's' : ''} still use “${name}”. Move or delete ${inUse > 1 ? 'them' : 'it'} first.`)
    }
    await tx.category.deleteMany({ where: { name } })
    await writeAudit(tx, { action: 'CATEGORY_DELETED', actor: ctx.actor, details: { category: name } })
    return { success: true }
  })
}

async function categoriesIn(tx: Tx): Promise<string[]> {
  const items = await tx.menuItem.findMany({ select: { category: true }, distinct: ['category'] })
  const custom = await tx.category.findMany({ select: { name: true } })
  return [...new Set([...items.map((i) => i.category), ...custom.map((c) => c.name)])]
}

// ---- Most Ordered ---------------------------------------------------------

export async function listMostOrdered() {
  const rows = await prisma.mostOrderedItem.findMany()
  return rows.map((r) => r.menuItemId)
}

export async function toggleMostOrdered(ctx: Ctx, menuItemId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.mostOrderedItem.findUnique({ where: { menuItemId } })
    if (existing) await tx.mostOrderedItem.delete({ where: { menuItemId } })
    else await tx.mostOrderedItem.create({ data: { menuItemId, addedBy: ctx.actor.name } })
    await writeAudit(tx, { action: existing ? 'MOST_ORDERED_REMOVED' : 'MOST_ORDERED_ADDED', actor: ctx.actor, details: { menuItemId } })
    return { success: true, added: !existing }
  })
}
