// Staff + salary advances — port of AppContext.jsx's addStaff/updateStaff/
// deleteStaff/toggleStaff and addAdvance/deleteAdvance/recoverAdvances.
//
// Auth fields (username/passwordHash/systemRole) are NOT touched here — a
// staff record created through this flow has no login by default, same as the
// frontend which had no concept of credentials. The frontend didn't audit
// advances; that parity is kept.

import { Prisma } from '@prisma/client'
import { prisma } from '../db/client.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'
import { hashPassword } from '../auth/password.js'
import { VALID_ROLES } from './auth.service.js'
import type { Role } from '../core/permissions.js'
import { enqueueOutbox } from '../sync/outbox.js'
import { createLedgerEntry, deleteLedgerEntry, ADVANCE_CATEGORY, SALARY_CATEGORY } from './accounting.service.js'

interface Ctx {
  actor: Actor
}

// Mirrors utils/attendanceHelpers.js SHIFT_START_TIMES — the shift's default
// check-in time, which Attendance/Payroll compare against for Late/Absent.
const SHIFT_START_TIMES: Record<string, string> = { Morning: '09:00', Evening: '16:00' }

export async function listStaff() {
  // Omit the hash: /api/staff is readable by every signed-in device (the POS
  // reads it for waiter selection), so shipping password hashes to all of them
  // hands out offline-crackable material for nothing — no caller uses it.
  return prisma.staff.findMany({ omit: { passwordHash: true }, orderBy: { createdAt: 'asc' } })
}

export interface StaffInput {
  name?: string
  role?: string
  shift?: string
  shiftStartTime?: string
  shiftEndTime?: string | null
  shiftEndMode?: string | null // "fixed" | "dayClosing"
  phone?: string
  email?: string
  baseSalary?: number
  deviceUserId?: string | null
  hireDate?: string | null
}

// The uFace 950 enrolls each person under a numeric ID entered on the device
// itself; this is only ever how a punch coming off the device gets matched
// back to a Staff row (attendanceDevice.service.ts), never written by the
// device flow. Empty string means "clear the link", not "leave unset".
async function checkDeviceUserIdAvailable(deviceUserId: string, excludeStaffId?: string) {
  const existing = await prisma.staff.findUnique({ where: { deviceUserId } })
  if (existing && existing.id !== excludeStaffId) {
    throw new ServiceError('That attendance machine ID is already linked to another staff member.', 409)
  }
}

// checkDeviceUserIdAvailable runs before the transaction, so two requests
// linking the same device ID at the same instant could both pass it — the
// schema's @unique constraint is what actually prevents the bad data either
// way, this just turns that race's raw Prisma error into the same friendly
// message the common (non-racing) path already gives.
function rethrowDeviceUserIdConflict(err: unknown): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    (err.meta?.target as string[] | undefined)?.includes('deviceUserId')
  ) {
    throw new ServiceError('That attendance machine ID is already linked to another staff member.', 409)
  }
  throw err
}

export async function addStaff(ctx: Ctx, emp: StaffInput) {
  const name = (emp.name ?? '').trim()
  if (!name) throw new ServiceError('Employee name is required.')
  const shift = emp.shift || 'Morning'
  const deviceUserId = emp.deviceUserId?.trim() || null
  if (deviceUserId) await checkDeviceUserIdAvailable(deviceUserId)
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.staff.create({
        data: {
          name,
          role: emp.role || 'Waiter',
          shift,
          // Derive the start time from the shift (same as the seed) so a record
          // without one doesn't always read as Absent.
          shiftStartTime: emp.shiftStartTime || SHIFT_START_TIMES[shift] || SHIFT_START_TIMES.Morning,
          shiftEndTime: emp.shiftEndTime ?? null,
          shiftEndMode: emp.shiftEndMode ?? null,
          phone: emp.phone ?? null,
          email: emp.email ?? null,
          baseSalary: Number(emp.baseSalary) || 0,
          deviceUserId,
          hireDate: emp.hireDate ? new Date(emp.hireDate) : null,
          active: true,
        },
      })
      await writeAudit(tx, { action: 'STAFF_ADDED', actor: ctx.actor, details: { staffId: created.id, name: created.name } })
      // Synced (docs/05-phase-4-vps-sync.md "Production hardening") so a
      // ShiftReconciliation.staffId referencing this row can resolve on the
      // VPS — Postgres enforces that FK even though the local SQLite copy
      // doesn't necessarily.
      await enqueueOutbox(tx, 'Staff', created.id, created)
      return created
    })
  } catch (err) {
    rethrowDeviceUserIdConflict(err)
  }
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
  if (updates.hireDate !== undefined) data.hireDate = updates.hireDate ? new Date(updates.hireDate) : null
  if (updates.deviceUserId !== undefined) {
    const deviceUserId = updates.deviceUserId?.trim() || null
    if (deviceUserId) await checkDeviceUserIdAvailable(deviceUserId, id)
    data.deviceUserId = deviceUserId
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.staff.update({ where: { id }, data })
      await enqueueOutbox(tx, 'Staff', updated.id, updated)
      return updated
    })
  } catch (err) {
    rethrowDeviceUserIdConflict(err)
  }
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
  return prisma.$transaction(async (tx) => {
    const updated = await tx.staff.update({ where: { id }, data: { active: !s.active } })
    await enqueueOutbox(tx, 'Staff', updated.id, updated)
    return updated
  })
}

// ---- Self-signup + approval -----------------------------------------------
// Mirrors recipes.service.ts's approveRecipe/rejectRecipe pending-approval
// shape (see also Staff.status's schema comment) rather than inventing a new
// one. Unlike every other mutator here, `signup` runs with no authenticated
// actor (see auth.routes.ts POST /api/auth/signup, registered with no
// preHandler) — the audit entry uses a synthetic actor built from the row it
// just created, which is why 'Pending' had to become a real Role rather than
// staying an unrecognized string.

export interface SignupInput {
  name?: string
  username?: string
  password?: string
}

export async function signup(input: SignupInput) {
  const name = (input.name ?? '').trim()
  const username = (input.username ?? '').trim().toLowerCase()
  const password = input.password ?? ''
  if (!name || !username || !password) {
    throw new ServiceError('Name, username, and password are required.', 400)
  }
  if (password.length < 6) {
    throw new ServiceError('Password must be at least 6 characters.', 400)
  }
  const existing = await prisma.staff.findUnique({ where: { username } })
  if (existing) throw new ServiceError('Username already taken.', 409)

  return prisma.$transaction(async (tx) => {
    const created = await tx.staff.create({
      data: {
        name,
        username,
        passwordHash: await hashPassword(password),
        role: 'Pending',
        systemRole: null,
        status: 'pending',
        active: true,
      },
    })
    const actor: Actor = { id: created.id, name: created.name, role: 'Pending' }
    await writeAudit(tx, { action: 'STAFF_SIGNUP_REQUESTED', actor, details: { username } })
    await enqueueOutbox(tx, 'Staff', created.id, created)
    return created
  })
}

export async function listPendingSignups() {
  return prisma.staff.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' } })
}

export async function approveSignup(ctx: Ctx, id: string, systemRole: unknown) {
  if (!VALID_ROLES.includes(systemRole as Role)) {
    throw new ServiceError('A valid role (Admin, Manager, Cashier, or Kitchen) is required.', 400)
  }
  return prisma.$transaction(async (tx) => {
    const s = await tx.staff.findUnique({ where: { id } })
    if (!s) throw new ServiceError('Signup request not found.', 404)
    const at = new Date()
    const updated = await tx.staff.update({
      where: { id },
      // role is the placeholder 'Pending' job title set at signup; promote it to the
      // assigned systemRole so the Employees table stops showing a "Pending" role badge.
      data: { role: systemRole as Role, systemRole: systemRole as Role, status: 'approved', approvedBy: ctx.actor.name, approvedAt: at },
    })
    await writeAudit(tx, { action: 'STAFF_SIGNUP_APPROVED', actor: ctx.actor, at, details: { staffId: id, systemRole } })
    await enqueueOutbox(tx, 'Staff', updated.id, updated)
    return updated
  })
}

export async function rejectSignup(ctx: Ctx, id: string, reason = '') {
  return prisma.$transaction(async (tx) => {
    const s = await tx.staff.findUnique({ where: { id } })
    if (!s) throw new ServiceError('Signup request not found.', 404)
    const at = new Date()
    const updated = await tx.staff.update({
      where: { id },
      data: { status: 'rejected', rejectedBy: ctx.actor.name, rejectedAt: at, rejectReason: reason },
    })
    await writeAudit(tx, { action: 'STAFF_SIGNUP_REJECTED', actor: ctx.actor, at, details: { staffId: id, reason } })
    await enqueueOutbox(tx, 'Staff', updated.id, updated)
    return updated
  })
}

// ---- Advances -------------------------------------------------------------

export async function listAdvances() {
  return prisma.advance.findMany({ orderBy: { date: 'desc' } })
}

// An advance is cash out of the drawer on the day it is handed over, so it is
// booked to the ledger immediately. It is NOT extra money on top of payroll —
// it is salary paid early, so monthFigures() nets the month's advances back out
// of that month's payroll (see frontend utils/accounting.js) to avoid counting
// the same rupee twice.
export async function addAdvance(
  ctx: Ctx,
  input: { staffId?: string; amount?: number; reason?: string; date?: string; deductFromSalaryDate?: string },
) {
  if (!input.staffId) throw new ServiceError('A staff member is required.')
  const amount = Number(input.amount) || 0
  const date = input.date ? new Date(input.date) : new Date()
  if (Number.isNaN(date.getTime())) throw new ServiceError('A valid advance date is required.')
  // Purely informational for the Advance Salary report — not validated against
  // payroll periods, so an invalid/blank value is just left unset.
  const deductFromSalaryDate = input.deductFromSalaryDate ? new Date(input.deductFromSalaryDate) : null
  if (deductFromSalaryDate && Number.isNaN(deductFromSalaryDate.getTime())) throw new ServiceError('Invalid deduct-from-salary date.')

  return prisma.$transaction(async (tx) => {
    const member = await tx.staff.findUnique({ where: { id: input.staffId as string } })
    if (!member) throw new ServiceError('Staff member not found.', 404)

    const advance = await tx.advance.create({
      data: {
        staffId: input.staffId as string,
        amount,
        reason: input.reason ?? '',
        date,
        status: 'pending',
        deductFromSalaryDate,
      },
    })

    // Zero-rupee advances are meaningless as a ledger row; skip the expense but
    // keep the record so the payroll modal still shows it.
    if (amount > 0) {
      const txn = await createLedgerEntry(tx, {
        type: 'expense',
        category: ADVANCE_CATEGORY,
        description: `${member.name}${input.reason ? ` — ${input.reason}` : ''}`,
        amount,
        date,
        source: 'advance',
        sourceId: advance.id,
      })
      const linked = await tx.advance.update({ where: { id: advance.id }, data: { transactionId: txn.id } })
      // The frontend never audited advances, and that parity was kept until
      // now — an advance moves money since it books a ledger expense, so
      // ../../CLAUDE.md's audit convention applies.
      await writeAudit(tx, {
        action: 'ADVANCE_GIVEN',
        actor: ctx.actor,
        details: { advanceId: linked.id, staffId: member.id, staffName: member.name, amount },
      })
      return linked
    }
    return advance
  })
}

export async function deleteAdvance(ctx: Ctx, id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.advance.findUnique({ where: { id } })
    if (!existing) throw new ServiceError('Advance not found.', 404)
    await deleteLedgerEntry(tx, existing.transactionId)
    await tx.advance.delete({ where: { id } })
    await writeAudit(tx, {
      action: 'ADVANCE_DELETED',
      actor: ctx.actor,
      details: { advanceId: id, staffId: existing.staffId, amount: existing.amount },
    })
    return { success: true }
  })
}

// Mark a month's pending advances recovered. Whole-month (payroll confirm) when
// staffId is omitted, or scoped to one staff (their "Done" in the payroll modal).
export async function recoverAdvances(_ctx: Ctx, year: number, monthIndex: number, staffId?: string) {
  const start = new Date(year, monthIndex, 1)
  const end = new Date(year, monthIndex + 1, 1)
  const result = await prisma.advance.updateMany({
    where: { status: 'pending', date: { gte: start, lt: end }, ...(staffId ? { staffId } : {}) },
    data: { status: 'recovered' },
  })
  return { recovered: result.count }
}

// Records that a staff member's salary for (year, month) was actually paid.
// paidAt is a real-world date entered by the caller (defaults to now if
// omitted), independent of which period it covers — a payment made on 5 Aug
// can be for July's salary. Re-marking the same (staffId, year, month) is a
// correction: retract the old ledger row before minting the new one, same as
// deleteAdvance + addAdvance would, rather than leaving an orphaned expense.
export async function markSalaryPaid(
  ctx: Ctx,
  staffId: string,
  opts: { year: number; month: number; amount: number; paidAt?: string },
) {
  const member = await prisma.staff.findUnique({ where: { id: staffId } })
  if (!member) throw new ServiceError('Employee not found.', 404)
  const amount = Math.round(Number(opts.amount) || 0)
  const paidAt = opts.paidAt ? new Date(opts.paidAt) : new Date()
  if (Number.isNaN(paidAt.getTime())) throw new ServiceError('A valid payment date is required.')

  return prisma.$transaction(async (tx) => {
    const existing = await tx.salaryPayment.findUnique({
      where: { staffId_year_month: { staffId, year: opts.year, month: opts.month } },
    })
    if (existing) await deleteLedgerEntry(tx, existing.transactionId)

    let txn = null
    if (amount > 0) {
      txn = await createLedgerEntry(tx, {
        type: 'expense',
        category: SALARY_CATEGORY,
        description: `${member.name} — ${opts.year}-${String(opts.month + 1).padStart(2, '0')} salary`,
        amount,
        date: paidAt,
        source: 'salary',
        sourceId: staffId,
      })
    }

    const payment = await tx.salaryPayment.upsert({
      where: { staffId_year_month: { staffId, year: opts.year, month: opts.month } },
      create: {
        staffId,
        year: opts.year,
        month: opts.month,
        amount,
        paidAt,
        paidBy: ctx.actor.name,
        paidByRole: ctx.actor.role,
        transactionId: txn?.id ?? null,
      },
      update: { amount, paidAt, paidBy: ctx.actor.name, paidByRole: ctx.actor.role, transactionId: txn?.id ?? null },
    })
    await writeAudit(tx, {
      action: existing ? 'SALARY_PAID_UPDATED' : 'SALARY_PAID',
      actor: ctx.actor,
      details: { staffId, staffName: member.name, year: opts.year, month: opts.month, amount },
    })
    await enqueueOutbox(tx, 'SalaryPayment', payment.id, payment)
    return payment
  })
}

// Undo a mark-paid — a correction path, mirrors deleteAdvance exactly.
export async function unmarkSalaryPaid(ctx: Ctx, staffId: string, year: number, month: number) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.salaryPayment.findUnique({ where: { staffId_year_month: { staffId, year, month } } })
    if (!existing) throw new ServiceError('No salary payment recorded for this month.', 404)
    await deleteLedgerEntry(tx, existing.transactionId)
    await tx.salaryPayment.delete({ where: { id: existing.id } })
    await writeAudit(tx, {
      action: 'SALARY_PAID_UNDONE',
      actor: ctx.actor,
      details: { staffId, year, month, amount: existing.amount },
    })
    return { success: true }
  })
}

export async function listSalaryPayments(year: number, month: number) {
  const rows = await prisma.salaryPayment.findMany({ where: { year, month } })
  const map: Record<string, (typeof rows)[number]> = {}
  for (const r of rows) map[r.staffId] = r
  return map
}
