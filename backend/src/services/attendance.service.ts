// Attendance — port of AppContext.jsx's overrideAttendance (the Admin/Manager
// emergency manual entry when the biometric machine failed). Normal attendance
// is machine-fed and read-only; this is the one mutating path. Records are
// keyed by (staffId, day) — schema.prisma's @@unique — so an override upserts
// today's record rather than duplicating it.

import { prisma } from '../db/client.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'
import { toDayStr } from '../core/closing.js'
import { computeDayGap } from '../core/attendanceGaps.js'

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

// Real per-day late-arrival/early-departure minutes, plus real present/absent
// day counts and a day-by-day calendar status, for every active staff member
// in a given month — used by Payroll's per-minute deduction and its calendar
// "Details" view. Both used to be split (gaps real, absence-counting mock —
// see git history) but now that the ZKTeco machine is actually connected,
// there is real AttendanceRecord data to count from, so both come from the
// same query here instead of Payroll faking present/absent client-side.
export async function getMonthlyAttendanceGaps(year: number, month: number) {
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const now = new Date()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  // Days after "today" (or the whole month, for a past month) aren't counted
  // yet — mirrors the frontend mock's same lastCounted convention so a
  // future day reads as "upcoming", not a false absence.
  const lastCounted = isCurrentMonth ? now.getDate() : daysInMonth

  const [staffList, records, closings] = await Promise.all([
    prisma.staff.findMany({ where: { active: true } }),
    prisma.attendanceRecord.findMany({ where: { date: { gte: monthStart, lt: monthEnd } } }),
    prisma.dailyClosing.findMany({ where: { closingTime: { gte: monthStart, lt: monthEnd } }, orderBy: { closingTime: 'asc' } }),
  ])

  const recordsByStaff = new Map<string, typeof records>()
  // Day-of-month -> record, per staff, for the presence calendar below.
  const recordByStaffDay = new Map<string, Map<number, (typeof records)[number]>>()
  for (const r of records) {
    const list = recordsByStaff.get(r.staffId)
    if (list) list.push(r)
    else recordsByStaff.set(r.staffId, [r])

    let dayMap = recordByStaffDay.get(r.staffId)
    if (!dayMap) {
      dayMap = new Map()
      recordByStaffDay.set(r.staffId, dayMap)
    }
    dayMap.set(r.date.getDate(), r)
  }
  // Last closing wins if a date somehow has more than one (re-closed) — matches
  // getLatestClosing()'s "most recent" convention elsewhere in this service.
  const closingByDate = new Map<string, Date>()
  for (const c of closings) closingByDate.set(c.date, c.closingTime)

  type DayStatus = 'present' | 'absent' | 'upcoming' | 'notHired'
  const result: Record<
    string,
    {
      days: Array<{ date: string; checkIn: string | null; checkOut: string | null; lateMinutes: number; earlyMinutes: number | null }>
      totalLateMinutes: number
      totalEarlyMinutes: number
      avgShiftMinutes: number
      daysInMonth: number
      // Tenure-scoped: only days from this staff member's hireDate (or day 1
      // if unset/before this month) through lastCounted. fullWorkingDays is
      // the same figure with no hireDate restriction — every staff member's
      // workingDays equals it unless they were hired mid-month — used by the
      // caller to prorate baseSalary by (workingDays / fullWorkingDays).
      workingDays: number
      fullWorkingDays: number
      present: number
      absent: number
      statusByDay: Record<number, DayStatus>
    }
  > = {}

  for (const s of staffList) {
    const recs = recordsByStaff.get(s.id) || []
    const days: (typeof result)[string]['days'] = []
    let totalLateMinutes = 0
    let totalEarlyMinutes = 0
    const shiftMinuteSamples: number[] = []

    for (const r of recs) {
      if (!r.checkIn) continue
      const dateStr = toDayStr(r.date)
      const closingTimeForDate = s.shiftEndMode === 'dayClosing' ? closingByDate.get(dateStr) ?? null : null
      const { lateMinutes, earlyMinutes } = computeDayGap({
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        shiftStartTime: s.shiftStartTime,
        shiftEndTime: s.shiftEndTime,
        shiftEndMode: s.shiftEndMode,
        closingTimeForDate,
      })
      totalLateMinutes += lateMinutes
      if (earlyMinutes != null) {
        totalEarlyMinutes += earlyMinutes
        if (r.checkOut) shiftMinuteSamples.push(Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / 60000))
      }
      if (lateMinutes > 0 || (earlyMinutes ?? 0) > 0) {
        days.push({ date: dateStr, checkIn: r.checkIn.toISOString(), checkOut: r.checkOut?.toISOString() ?? null, lateMinutes, earlyMinutes })
      }
    }

    const avgShiftMinutes = shiftMinuteSamples.length
      ? Math.round(shiftMinuteSamples.reduce((a, b) => a + b, 0) / shiftMinuteSamples.length)
      : 480 // no real sample yet this month — 8h fallback, see payroll.ts calcNetSalary

    // Real presence calendar: this restaurant has no weekly off day (every
    // day is a working day), days after today are "upcoming", days before
    // this staff member's hireDate are "notHired" (not an absence — they
    // didn't exist yet), and every other day is present only if a real
    // AttendanceRecord (machine or manual) has a check-in — no record on a
    // working day genuinely means absent, not "no data yet".
    let tenureStart = 1
    if (s.hireDate) {
      if (s.hireDate >= monthEnd) tenureStart = daysInMonth + 1 // hired after this month entirely
      else if (s.hireDate >= monthStart) tenureStart = s.hireDate.getDate()
    }

    const dayMap = recordByStaffDay.get(s.id)
    const statusByDay: Record<number, DayStatus> = {}
    let workingDays = 0
    let present = 0
    for (let d = 1; d <= daysInMonth; d++) {
      if (d > lastCounted) {
        statusByDay[d] = 'upcoming'
        continue
      }
      if (d < tenureStart) {
        statusByDay[d] = 'notHired'
        continue
      }
      workingDays++
      if (dayMap?.get(d)?.checkIn) {
        statusByDay[d] = 'present'
        present++
      } else {
        statusByDay[d] = 'absent'
      }
    }

    result[s.id] = {
      days,
      totalLateMinutes,
      totalEarlyMinutes,
      avgShiftMinutes,
      daysInMonth,
      workingDays,
      fullWorkingDays: lastCounted,
      present,
      absent: workingDays - present,
      statusByDay,
    }
  }

  return result
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
