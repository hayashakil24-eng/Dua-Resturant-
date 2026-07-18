// Attendance — port of AppContext.jsx's overrideAttendance (the Admin-only
// emergency manual entry when the biometric machine failed). Normal attendance
// is machine-fed and read-only; this is the one mutating path. Records are
// keyed by (staffId, day) — schema.prisma's @@unique — so an override upserts
// today's record rather than duplicating it.

import { prisma } from '../db/client.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'

interface Ctx {
  actor: Actor
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function listAttendance() {
  return prisma.attendanceRecord.findMany({ where: { date: startOfToday() } })
}

export async function overrideAttendance(
  ctx: Ctx,
  staffId: string,
  opts: { checkIn?: string | null; checkOut?: string | null; reason?: string; notes?: string },
) {
  if (!opts.reason) throw new ServiceError('A reason is required for a manual attendance override.')
  const staff = await prisma.staff.findUnique({ where: { id: staffId } })
  if (!staff) throw new ServiceError('Employee not found.', 404)

  const checkIn = opts.checkIn ? new Date(opts.checkIn) : null
  const checkOut = opts.checkOut ? new Date(opts.checkOut) : null
  const status = checkOut ? 'Checked Out' : checkIn ? 'Present' : 'Absent'
  const date = startOfToday()
  const at = new Date()

  return prisma.$transaction(async (tx) => {
    const existing = await tx.attendanceRecord.findUnique({ where: { staffId_date: { staffId, date } } })
    const record = await tx.attendanceRecord.upsert({
      where: { staffId_date: { staffId, date } },
      create: {
        staffId,
        date,
        checkIn,
        checkOut,
        status,
        source: 'manual',
        manualBy: ctx.actor.name,
        manualByRole: ctx.actor.role,
        manualReason: opts.reason,
        manualNotes: opts.notes ?? '',
        manualAt: at,
      },
      update: {
        // Preserve an existing check-in/out if the override doesn't supply one,
        // matching the frontend's `checkIn ?? prev?.checkIn ?? null`.
        checkIn: checkIn ?? existing?.checkIn ?? null,
        checkOut: checkOut ?? existing?.checkOut ?? null,
        status,
        source: 'manual',
        manualBy: ctx.actor.name,
        manualByRole: ctx.actor.role,
        manualReason: opts.reason,
        manualNotes: opts.notes ?? '',
        manualAt: at,
      },
    })
    await writeAudit(tx, {
      action: 'ATTENDANCE_OVERRIDE',
      actor: ctx.actor,
      at,
      details: { staffId, staffName: staff.name, reason: opts.reason, notes: opts.notes ?? '' },
    })
    return record
  })
}
