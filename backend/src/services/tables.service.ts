// Tables — port of AppContext.jsx's addTable/updateTable/deleteTable, plus the
// hall-level operations the Tables page drives.
//
// Table.id is a meaningful Int business id (schema.prisma) with no
// autoincrement, so it used to be typed by hand in the UI. It is allocated here
// now (max + 1) — the client never sends one — and ids are never recycled after
// a delete: order.table is a bare Int with no FK, so an old bill still carries
// the id of a table that no longer exists, and reusing it would silently
// re-attribute that bill to a brand-new table.

import type { Prisma } from '@prisma/client'
import { prisma } from '../db/client.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'
import { broadcastEvent } from '../realtime/broadcast.js'
import { buildLabels, renumberLabels } from '../core/tableLabels.js'

interface Ctx {
  actor: Actor
}

type Tx = Prisma.TransactionClient

// One hall at a time. The largest seeded hall is 40 (mockData.js), so this is
// generous; the cap exists so a typo ("400") can't spawn a floor of tables.
const MAX_BULK = 100

const DEFAULT_SEATS = 4

async function nextFreeId(tx: Tx): Promise<number> {
  const { _max } = await tx.table.aggregate({ _max: { id: true } })
  return (_max.id ?? 0) + 1
}

const cleanCategory = (value: unknown): string => String(value ?? '').trim()

export async function listTables() {
  // Category first so a table added later sits at the end of its own hall
  // instead of after Delivery/Takeaway in every list on every screen.
  return prisma.table.findMany({ orderBy: [{ category: 'asc' }, { id: 'asc' }] })
}

export async function addTable(ctx: Ctx, input: { id?: number; number?: string; category?: string; section?: string; seats?: number }) {
  const category = cleanCategory(input.category) || 'Custom'
  return prisma.$transaction(async (tx) => {
    const id = input.id != null ? Number(input.id) : await nextFreeId(tx)
    if (!Number.isFinite(id) || id < 1) throw new ServiceError('A valid table id is required.')
    if (await tx.table.findUnique({ where: { id } })) throw new ServiceError('A table with this id already exists.')
    const members = await tx.table.findMany({ where: { category }, orderBy: { id: 'asc' } })
    const table = await tx.table.create({
      data: {
        id,
        // An empty label used to become the bare id ("303") sitting among
        // A1..HUT20; it now continues the hall's own numbering.
        number: (input.number ?? '').trim() || buildLabels(category, members, 1)[0] || String(id),
        category,
        section: (input.section ?? '').trim() || members[0]?.section || 'Indoor',
        seats: Number(input.seats) || DEFAULT_SEATS,
      },
    })
    await writeAudit(tx, {
      action: 'TABLE_ADDED',
      actor: ctx.actor,
      details: { table: id, label: table.number, category, seats: table.seats },
    })
    return table
  })
}

// Add a whole hall in one action. Deliberately not a loop of addTable calls
// from the client: 40 POSTs are 40 transactions, 40 audit rows and 40 socket
// broadcasts, each making every LAN device refetch the full table list — and a
// failure halfway leaves a half-built hall.
export async function bulkAddTables(
  ctx: Ctx,
  input: { category?: string; count?: number; seats?: number; section?: string },
) {
  const category = cleanCategory(input.category)
  if (!category) throw new ServiceError('A category is required.')
  // Delivery/Takeaway are fixed order types, not a hall of seats.
  if (category === 'Special') throw new ServiceError('Delivery and Takeaway are fixed — tables cannot be added to them.')
  const count = Number(input.count)
  if (!Number.isInteger(count) || count < 1 || count > MAX_BULK) {
    throw new ServiceError(`Add between 1 and ${MAX_BULK} tables at a time.`)
  }

  return prisma.$transaction(async (tx) => {
    const created = await createInCategory(tx, category, count, input.seats, input.section)
    const first = created[0]
    const last = created[created.length - 1]
    if (!first || !last) throw new ServiceError('No tables were created.')
    await writeAudit(tx, {
      action: 'TABLES_BULK_ADDED',
      actor: ctx.actor,
      details: {
        category,
        count,
        fromId: first.id,
        toId: last.id,
        firstLabel: first.number,
        lastLabel: last.number,
      },
    })
    return { created: count, firstLabel: first.number, lastLabel: last.number, tables: created }
  })
}

// Shared by bulkAddTables and updateTableCategory's "grow the hall" path.
async function createInCategory(tx: Tx, category: string, count: number, seats?: number, section?: string) {
  const members = await tx.table.findMany({ where: { category }, orderBy: { id: 'asc' } })
  const startId = await nextFreeId(tx)
  const labels = buildLabels(category, members, count)
  const rows = labels.map((number, i) => ({
    id: startId + i,
    number,
    category,
    section: (section ?? '').trim() || members[0]?.section || 'Indoor',
    seats: Number(seats) || members[0]?.seats || DEFAULT_SEATS,
  }))
  await tx.table.createMany({ data: rows })
  return rows
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
  const tid = Number(id)
  return prisma.$transaction(async (tx) => {
    const table = await tx.table.findUnique({ where: { id: tid } })
    if (!table) throw new ServiceError('Table not found.', 404)
    // Locked tables (Delivery/Takeaway) are fixed order types and can't be removed.
    if (table.locked) throw new ServiceError('This table is fixed and cannot be deleted.')
    // The UI disables this button, but a device holding a stale table list would
    // sail straight past that — same guard deleteTableCategory already applies.
    const running = await tx.order.count({ where: { table: tid, payment: 'Unpaid', cancelled: false } })
    if (running > 0) throw new ServiceError('This table has a running order — settle it first.')
    await tx.table.delete({ where: { id: tid } })
    // CLAUDE.md "no silent deletes": this used to only broadcast, leaving no
    // record of who removed a table. writeAudit broadcasts too.
    await writeAudit(tx, {
      action: 'TABLE_DELETED',
      actor: ctx.actor,
      details: { table: tid, label: table.number, category: table.category },
    })
    return { success: true }
  })
}

// Everything the hall edit form can do, in one transaction: rename (optionally
// merging into an existing hall), restyle seats/section for the whole group,
// grow it, and straighten drifted labels. One audit row for the lot.
export async function updateTableCategory(
  ctx: Ctx,
  input: { category?: string; newName?: string; seats?: number; section?: string; count?: number; renumber?: boolean },
) {
  const category = cleanCategory(input.category)
  if (!category) throw new ServiceError('A category is required.')
  const newName = cleanCategory(input.newName)
  const seats = input.seats != null && String(input.seats) !== '' ? Number(input.seats) : null
  const section = input.section != null ? String(input.section).trim() : null
  const wanted = input.count != null && String(input.count) !== '' ? Number(input.count) : null

  if (seats != null && (!Number.isFinite(seats) || seats < 1)) throw new ServiceError('Seats must be at least 1.')
  if (wanted != null && (!Number.isInteger(wanted) || wanted < 1)) throw new ServiceError('Enter how many tables this hall should have.')

  return prisma.$transaction(async (tx) => {
    const members = await tx.table.findMany({ where: { category }, orderBy: { id: 'asc' } })
    if (members.length === 0) throw new ServiceError('No tables found in this category.', 404)
    if (members.some((m) => m.locked)) throw new ServiceError('Delivery and Takeaway are fixed and cannot be changed.')

    const target = newName && newName !== category ? newName : category
    const added = wanted != null ? Math.max(0, wanted - members.length) : 0
    if (added > MAX_BULK) throw new ServiceError(`Add between 1 and ${MAX_BULK} tables at a time.`)
    // Shrinking is not a rename side effect — deleting tables stays an explicit,
    // per-table action so a mistyped count can never wipe a hall.
    if (wanted != null && wanted < members.length) {
      throw new ServiceError('To remove tables, delete them one by one — this only adds.')
    }

    if (target !== category) {
      // Merging into a hall that already exists must continue that hall's
      // numbering; restarting at 1 is exactly what produced today's duplicate
      // "A1" and "A 1" labels.
      const existing = await tx.table.findMany({ where: { category: target }, orderBy: { id: 'asc' } })
      const labels = buildLabels(target, existing, members.length)
      for (const [i, row] of members.entries()) {
        const number = labels[i]
        if (!number) continue
        await tx.table.update({ where: { id: row.id }, data: { category: target, number } })
      }
    }

    if (seats != null || section) {
      await tx.table.updateMany({
        where: { id: { in: members.map((m) => m.id) } },
        data: { ...(seats != null ? { seats } : {}), ...(section ? { section } : {}) },
      })
    }

    if (added > 0) {
      await createInCategory(tx, target, added, seats ?? undefined, section ?? undefined)
    }

    if (input.renumber) {
      const current = await tx.table.findMany({ where: { category: target }, orderBy: { id: 'asc' } })
      for (const row of renumberLabels(target, current)) {
        await tx.table.update({ where: { id: row.id }, data: { number: row.number } })
      }
    }

    await writeAudit(tx, {
      action: 'TABLE_CATEGORY_UPDATED',
      actor: ctx.actor,
      details: {
        category,
        ...(target !== category ? { renamedTo: target } : {}),
        ...(seats != null ? { seats } : {}),
        ...(section ? { section } : {}),
        ...(added > 0 ? { added } : {}),
        ...(input.renumber ? { renumbered: true } : {}),
        members: members.length,
      },
    })
    return { success: true, category: target, added, members: members.length }
  })
}

// Kept for the existing POST /api/tables/category/rename route — the hall edit
// form goes through updateTableCategory, which continues the target hall's
// numbering instead of restarting at 1.
export async function renameTableCategory(ctx: Ctx, fromCategory: string, newName: string) {
  if (!fromCategory || !(newName ?? '').trim()) throw new ServiceError('A category and a new name are required.')
  const res = await updateTableCategory(ctx, { category: fromCategory, newName })
  return { renamed: res.members }
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
