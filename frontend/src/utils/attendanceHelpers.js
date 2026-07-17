// Attendance status is derived on the frontend from the biometric check-in time
// against each staff member's shift start. A grace window keeps small delays
// from being flagged as "Late" — the client set this to 60 minutes.
export const LATE_GRACE_PERIOD_MINUTES = 60

// Default shift start times (24h "HH:MM") by shift name, used as a fallback when
// a staff record has no explicit shiftStartTime.
export const SHIFT_START_TIMES = {
  Morning: '09:00',
  Evening: '16:00',
}

// Build a Date at "HH:MM" on the same calendar day as the given reference date.
function shiftStartOn(referenceDate, shiftStartTime) {
  const [h, m] = shiftStartTime.split(':').map(Number)
  const d = new Date(referenceDate)
  d.setHours(h, m, 0, 0)
  return d
}

/**
 * Determine attendance status from the check-in time vs. the shift start.
 * The check-in is a full ISO timestamp, so we anchor the shift start to that
 * same day rather than needing a separate date argument.
 *
 * @param {string|Date|null} checkIn - When the employee checked in (ISO or Date).
 * @param {string} shiftStartTime - Shift start as "HH:MM" (e.g. "09:00").
 * @returns {{ status: 'Present'|'Late'|'Absent', lateByMinutes: number|null }}
 */
export function getAttendanceStatus(checkIn, shiftStartTime) {
  if (!checkIn || !shiftStartTime) {
    return { status: 'Absent', lateByMinutes: null }
  }

  const checkInAt = new Date(checkIn)
  const shiftStart = shiftStartOn(checkInAt, shiftStartTime)
  const cutoff = new Date(shiftStart.getTime() + LATE_GRACE_PERIOD_MINUTES * 60000)

  if (checkInAt <= cutoff) {
    return { status: 'Present', lateByMinutes: null }
  }

  // Report lateness from the shift start (not the cutoff), so "how late" reflects
  // the true delay, not the delay past the grace window.
  const lateByMinutes = Math.round((checkInAt - shiftStart) / 60000)
  return { status: 'Late', lateByMinutes }
}

/**
 * Resolve the full display status for an attendance record, applying the usual
 * precedence: checked out beats a live check-in, which beats absent.
 *
 * @param {{ checkIn?: string|null, checkOut?: string|null }|null|undefined} record
 * @param {string} shiftStartTime - Shift start as "HH:MM".
 * @returns {{ status: 'Present'|'Late'|'Checked Out'|'Absent', lateByMinutes: number|null }}
 */
export function resolveAttendanceStatus(record, shiftStartTime) {
  if (!record) return { status: 'Absent', lateByMinutes: null }
  if (record.checkOut) return { status: 'Checked Out', lateByMinutes: null }
  if (record.checkIn) return getAttendanceStatus(record.checkIn, shiftStartTime)
  return { status: 'Absent', lateByMinutes: null }
}

/**
 * Format a lateness duration for display, e.g. 90 -> "1h 30m late", 5 -> "5m late".
 */
export function formatLateDuration(minutes) {
  if (!minutes) return ''
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}m late` : `${mins}m late`
}
