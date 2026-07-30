// Ported from frontend/src/utils/attendanceHelpers.js's getAttendanceStatus/
// computeDayGap — kept in sync by hand (same mirroring convention as
// payroll.js/payroll.ts). Real per-day late-arrival / early-departure gap,
// used by attendance.service.ts's monthly gaps query for payroll deduction.

export const LATE_GRACE_PERIOD_MINUTES = 15

function shiftStartOn(referenceDate: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(referenceDate)
  d.setHours(h ?? 0, m ?? 0, 0, 0)
  return d
}

// Anchor "HH:MM" to referenceDate's calendar day, rolling to the next day if
// the result would fall before shiftStartTime that same day (an overnight
// shift) — otherwise an overnight checkout compares against an expected-end
// time twelve-plus hours in the past.
function shiftTimeOn(referenceDate: Date, hhmm: string, shiftStartTime?: string | null): Date {
  const d = shiftStartOn(referenceDate, hhmm)
  if (shiftStartTime) {
    const start = shiftStartOn(referenceDate, shiftStartTime)
    if (d < start) d.setDate(d.getDate() + 1)
  }
  return d
}

export function lateMinutesFor(checkIn: Date | string | null | undefined, shiftStartTime: string | null | undefined): number {
  if (!checkIn || !shiftStartTime) return 0
  const checkInAt = new Date(checkIn)
  const shiftStart = shiftStartOn(checkInAt, shiftStartTime)
  const cutoff = new Date(shiftStart.getTime() + LATE_GRACE_PERIOD_MINUTES * 60000)
  if (checkInAt <= cutoff) return 0
  return Math.round((checkInAt.getTime() - shiftStart.getTime()) / 60000)
}

export interface DayGapInput {
  checkIn?: Date | string | null
  checkOut?: Date | string | null
  shiftStartTime?: string | null
  shiftEndTime?: string | null
  shiftEndMode?: string | null // "fixed" | "dayClosing"
  closingTimeForDate?: Date | string | null
}

export interface DayGap {
  lateMinutes: number
  earlyMinutes: number | null // null = unknown (e.g. dayClosing mode, day not yet closed)
}

export function computeDayGap({ checkIn, checkOut, shiftStartTime, shiftEndTime, shiftEndMode, closingTimeForDate }: DayGapInput): DayGap {
  const lateMinutes = lateMinutesFor(checkIn, shiftStartTime)

  let earlyMinutes: number | null = null
  if (checkOut) {
    const checkOutAt = new Date(checkOut)
    let expectedEnd: Date | null = null
    if (shiftEndMode === 'fixed' && shiftEndTime) {
      expectedEnd = shiftTimeOn(checkOutAt, shiftEndTime, shiftStartTime)
    } else if (shiftEndMode === 'dayClosing' && closingTimeForDate) {
      expectedEnd = new Date(closingTimeForDate)
    }
    if (expectedEnd) {
      earlyMinutes = Math.max(0, Math.round((expectedEnd.getTime() - checkOutAt.getTime()) / 60000))
    }
  }

  return { lateMinutes, earlyMinutes }
}
