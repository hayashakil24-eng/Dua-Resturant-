// Tables — port of AppContext.jsx's addTable/updateTable/deleteTable.
// Table.id is a meaningful Int business id (schema.prisma). The frontend's
// addTable only supplied {id, seats, section}; the schema also needs
// number/category, so those are defaulted here (number = the id, category =
// supplied or "Custom") rather than left undefined.

import { prisma } from '../db/client.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'
import { broadcastEvent } from '../realtime/broadcast.js'

interface Ctx {
  actor: Actor
}

export async function listTables() {
  return prisma.table.findMany({ orderBy: { id: 'asc' } })
}

export async function addTable(ctx: Ctx, input: { id?: number; number?: string; category?: string; section?: string; seats?: number }) {
  const id = Number(input.id)
  if (!Number.isFinite(id)) throw new ServiceError('A valid table id is required.')
  return prisma.$transaction(async (tx) => {
    if (await tx.table.findUnique({ where: { id } })) throw new ServiceError('A table with this id already exists.')
    const table = await tx.table.create({
      data: {
        id,
        number: (input.number ?? '').trim() || String(id),
        category: input.category || 'Custom',
        section: input.section || '',
        seats: Number(input.seats) || 2,
      },
    })
    await writeAudit(tx, { action: 'TABLE_ADDED', actor: ctx.actor, details: { table: id, seats: table.seats } })
    return table
  })
}

export async function updateTable(ctx: Ctx, id: number, updates: { number?: string; category?: string; section?: string; seats?: number }) {
  const data: Record<string, unknown> = {}
  if (updates.number != null) data.number = updates.number
  if (updates.category != null) data.category = updates.category
  if (updates.section != null) data.section = updates.section
  if (updates.seats != null) data.seats = Number(updates.seats) || 0
  const table = await prisma.table.update({ where: { id: Number(id) }, data })
  broadcastEvent({ action: 'TABLE_UPDATED', actor: ctx.actor, details: { table: id } })
  return table
}

export async function deleteTable(ctx: Ctx, id: number) {
  const table = await prisma.table.findUnique({ where: { id: Number(id) } })
  if (!table) throw new ServiceError('Table not found.', 404)
  // Locked tables (Delivery/Takeaway) are fixed order types and can't be removed.
  if (table.locked) throw new ServiceError('This table is fixed and cannot be deleted.')
  await prisma.table.delete({ where: { id: Number(id) } })
  broadcastEvent({ action: 'TABLE_DELETED', actor: ctx.actor, details: { table: id } })
  return { success: true }
}

// Rename a whole category and relabel its tables to "<newName> 1..N" (ordered by
// id). Labels are read live across the app, so this shows on POS/KDS/bill too.
export async function renameTableCategory(ctx: Ctx, fromCategory: string, newName: string) {
  const name = (newName ?? '').trim()
  if (!fromCategory || !name) throw new ServiceError('A category and a new name are required.')
  return prisma.$transaction(async (tx) => {
    const members = await tx.table.findMany({ where: { category: fromCategory }, orderBy: { id: 'asc' } })
    if (members.length === 0) throw new ServiceError('No tables found in this category.', 404)
    let i = 0
    for (const tbl of members) {
      i += 1
      await tx.table.update({ where: { id: tbl.id }, data: { category: name, number: `${name} ${i}` } })
    }
    await writeAudit(tx, { action: 'TABLE_CATEGORY_RENAMED', actor: ctx.actor, details: { from: fromCategory, to: name, count: members.length } })
    return { renamed: members.length }
  })
}

// Delete every table in a category. Blocks if any member has a running order;
// locked (Delivery/Takeaway) tables are skipped, never removed.
export async function deleteTableCategory(ctx: Ctx, category: string) {
  if (!category) throw new ServiceError('A category is required.')
  return prisma.$transaction(async (tx) => {
    const members = await tx.table.findMany({ where: { category } })
    if (members.length === 0) throw new ServiceError('No tables found in this category.', 404)
    const ids = members.map((m) => m.id)
    const running = await tx.order.count({ where: { table: { in: ids }, payment: 'Unpaid', cancelled: false } })
    if (running > 0) throw new ServiceError('Some tables in this category are in use — settle their orders first.')
    const deletable = members.filter((m) => !m.locked).map((m) => m.id)
    await tx.table.deleteMany({ where: { id: { in: deletable } } })
    await writeAudit(tx, { action: 'TABLE_CATEGORY_DELETED', actor: ctx.actor, details: { category, count: deletable.length } })
    return { deleted: deletable.length }
  })
}
