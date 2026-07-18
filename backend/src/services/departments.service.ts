// Department / counter routing — port of AppContext.jsx's addDepartment/
// deleteDepartment/assignItemToDepartment/removeItemFromDepartment.
//
// The frontend stored an item-id list on each department and enforced "one
// department per item" by removing the item from every other department first.
// Here that invariant is a real FK: MenuItem.departmentId (schema.prisma). So
// assigning an item is a single column update that inherently moves it — no
// manual removal from other departments needed. The frontend didn't audit
// these; parity kept.

import { prisma } from '../db/client.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'

interface Ctx {
  actor: Actor
}

// Departments plus the ids of the menu items routed to each (reconstructs the
// frontend's department.items[] from MenuItem.departmentId).
export async function listDepartments() {
  const [depts, items] = await Promise.all([
    prisma.department.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.menuItem.findMany({ where: { departmentId: { not: null } }, select: { id: true, departmentId: true } }),
  ])
  return depts.map((d) => ({ ...d, items: items.filter((i) => i.departmentId === d.id).map((i) => i.id) }))
}

export async function addDepartment(ctx: Ctx, input: { name?: string; nameUrdu?: string; description?: string; manager?: string; managerId?: string }) {
  const name = (input.name ?? '').trim()
  if (!name) throw new ServiceError('Department name is required.')
  const dept = await prisma.department.create({
    data: {
      name,
      nameUrdu: (input.nameUrdu ?? '').trim() || null,
      description: (input.description ?? '').trim() || null,
      manager: (input.manager ?? '').trim() || null,
      managerId: input.managerId || null,
      status: 'active',
      createdBy: ctx.actor.name,
    },
  })
  return { ...dept, items: [] as string[] }
}

export async function deleteDepartment(_ctx: Ctx, id: string) {
  await prisma.department.delete({ where: { id } }) // menu items' departmentId is SetNull
  return { success: true }
}

// Assign MOVES the item: setting departmentId reassigns it away from any other
// department automatically (one department per item).
export async function assignItemToDepartment(_ctx: Ctx, itemId: string, departmentId: string) {
  const [item, dept] = await Promise.all([
    prisma.menuItem.findUnique({ where: { id: itemId } }),
    prisma.department.findUnique({ where: { id: departmentId } }),
  ])
  if (!item) throw new ServiceError('Menu item not found.', 404)
  if (!dept) throw new ServiceError('Department not found.', 404)
  await prisma.menuItem.update({ where: { id: itemId }, data: { departmentId } })
  return { success: true }
}

export async function removeItemFromDepartment(_ctx: Ctx, itemId: string, departmentId: string) {
  const item = await prisma.menuItem.findUnique({ where: { id: itemId } })
  if (!item) throw new ServiceError('Menu item not found.', 404)
  // Only clear if it's actually routed to this department, matching the frontend.
  if (item.departmentId === departmentId) {
    await prisma.menuItem.update({ where: { id: itemId }, data: { departmentId: null } })
  }
  return { success: true }
}
