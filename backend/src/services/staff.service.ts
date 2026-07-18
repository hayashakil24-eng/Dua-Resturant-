// Staff + salary advances — port of AppContext.jsx's addStaff/updateStaff/
// deleteStaff/toggleStaff and addAdvance/deleteAdvance/recoverAdvances.
//
// Auth fields (username/passwordHash/systemRole) are NOT touched here — a
// staff record created through this flow has no login by default, same as the
// frontend which had no concept of credentials. The frontend didn't audit
// advances; that parity is kept.

import { prisma } from '../db/client.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'

interface Ctx {
  actor: Actor
}

// Mirrors utils/attendanceHelpers.js SHIFT_START_TIMES — the shift's default
// check-in time, which Attendance/Payroll compare against for Late/Absent.
const SHIFT_START_TIMES: Record<string, string> = { Morning: '09:00', Evening: '16:00' }

export async function listStaff() {
  return prisma.staff.findMany({ orderBy: { createdAt: 'asc' } })
}

export interface StaffInput {
  name?: string
  role?: string
  shift?: string
  shiftStartTime?: string
  phone?: string
  email?: string
  baseSalary?: number
}

export async function addStaff(ctx: Ctx, emp: StaffInput) {
  const name = (emp.name ?? '').trim()
  if (!name) throw new ServiceError('Employee name is required.')
  const shift = emp.shift || 'Morning'
  return prisma.$transaction(async (tx) => {
    const created = await tx.staff.create({
      data: {
        name,
        role: emp.role || 'Waiter',
        shift,
        // Derive the start time from the shift (same as the seed) so a record
        // without one doesn't always read as Absent.
        shiftStartTime: emp.shiftStartTime || SHIFT_START_TIMES[shift] || SHIFT_START_TIMES.Morning,
        phone: emp.phone ?? null,
        email: emp.email ?? null,
        baseSalary: Number(emp.baseSalary) || 0,
        active: true,
      },
    })
    await writeAudit(tx, { action: 'STAFF_ADDED', actor: ctx.actor, details: { staffId: created.id, name: created.name } })
    return created
  })
}

export async function updateStaff(_ctx: Ctx, id: string, updates: StaffInput) {
  const current = await prisma.staff.findUnique({ where: { id } })
  if (!current) throw new ServiceError('Employee not found.', 404)
  const data: Record<string, unknown> = { ...updates }
  // Re-derive shiftStartTime when the shift name changes without an explicit
  // start time, so Attendance/Payroll stay correct after an edit.
  if (updates.shift && updates.shift !== current.shift && updates.shiftStartTime === undefined) {
    data.shiftStartTime = SHIFT_START_TIMES[updates.shift] || current.shiftStartTime
  }
  if (updates.baseSalary != null) data.baseSalary = Number(updates.baseSalary) || 0
  return prisma.staff.update({ where: { id }, data })
}

export async function deleteStaff(ctx: Ctx, id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.staff.delete({ where: { id } })
    await writeAudit(tx, { action: 'STAFF_DELETED', actor: ctx.actor, details: { staffId: id } })
    return { success: true }
  })
}

export async function toggleStaff(_ctx: Ctx, id: string) {
  const s = await prisma.staff.findUnique({ where: { id } })
  if (!s) throw new ServiceError('Employee not found.', 404)
  return prisma.staff.update({ where: { id }, data: { active: !s.active } })
}

// ---- Advances -------------------------------------------------------------

export async function listAdvances() {
  return prisma.advance.findMany({ orderBy: { date: 'desc' } })
}

export async function addAdvance(_ctx: Ctx, input: { staffId?: string; amount?: number; reason?: string; date?: string }) {
  if (!input.staffId) throw new ServiceError('A staff member is required.')
  return prisma.advance.create({
    data: {
      staffId: input.staffId,
      amount: Number(input.amount) || 0,
      reason: input.reason ?? '',
      date: input.date ? new Date(input.date) : new Date(),
      status: 'pending',
    },
  })
}

export async function deleteAdvance(_ctx: Ctx, id: string) {
  await prisma.advance.delete({ where: { id } })
  return { success: true }
}

// Mark a month's pending advances recovered (called on payroll confirm).
export async function recoverAdvances(_ctx: Ctx, year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1)
  const end = new Date(year, monthIndex + 1, 1)
  const result = await prisma.advance.updateMany({
    where: { status: 'pending', date: { gte: start, lt: end } },
    data: { status: 'recovered' },
  })
  return { recovered: result.count }
}
