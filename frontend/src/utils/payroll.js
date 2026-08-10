import { STAFF } from '../data/mockData.js'

// ---------------------------------------------------------------------------
// Payroll math — shared by the Payroll page and the Admin dashboard so both
// compute salaries identically. Attendance is deterministic mock data (stable
// per staff + month); swap monthAttendance() for a real query when wired.
//   salary = baseSalary / (working days, Sundays excluded) × present days
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function monthAttendance(staffId, year, month, today) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth()
  const lastCounted = isCurrentMonth ? today.getDate() : daysInMonth

  const seedNum = Number(staffId.replace(/\D/g, '')) * 1000 + year * 13 + month
  const rng = mulberry32(seedNum)

  // No weekly off day at this restaurant — every day up to lastCounted is a
  // working day.
  const workingDayNums = []
  const statusByDay = {}
  for (let d = 1; d <= daysInMonth; d++) {
    if (d > lastCounted) statusByDay[d] = 'upcoming'
    else {
      statusByDay[d] = 'present'
      workingDayNums.push(d)
    }
  }

  const maxAbsent = Math.min(3, workingDayNums.length)
  const numAbsent = Math.floor(rng() * (maxAbsent + 1))
  const shuffled = [...workingDayNums].sort(() => rng() - 0.5)
  for (let i = 0; i < numAbsent; i++) statusByDay[shuffled[i]] = 'absent'

  const workingDays = workingDayNums.length
  return {
    daysInMonth,
    workingDays,
    present: workingDays - numAbsent,
    absent: numAbsent,
    statusByDay,
  }
}

export const calcSalary = (base, workingDays, present) =>
  workingDays > 0 ? Math.round((base / workingDays) * present) : 0

// Full deduction breakdown for the Payroll page: 4 free absences/month (only
// days beyond that dock pay), plus real per-minute late-arrival and
// early-departure deductions. absent/workingDays still come from
// monthAttendance() (mock, per the client's choice — see this file's header
// comment); lateMinutes/earlyMinutes/shiftMinutes come from the real
// GET /api/attendance/gaps query. shiftMinutes falls back to 480 (8h) when an
// employee has no configured/observed shift length yet.
const FREE_OFFS_PER_MONTH = 4
export function calcNetSalary({ base, workingDays, absent, lateMinutes = 0, earlyMinutes = 0, shiftMinutes = 480 }) {
  const perDayRate = workingDays > 0 ? base / workingDays : 0
  const paidAbsences = Math.max(0, (absent || 0) - FREE_OFFS_PER_MONTH)
  const absenceDeduction = Math.round(paidAbsences * perDayRate)
  const perMinuteRate = shiftMinutes > 0 ? perDayRate / shiftMinutes : 0
  const lateDeduction = Math.round((lateMinutes || 0) * perMinuteRate)
  const earlyDeduction = Math.round((earlyMinutes || 0) * perMinuteRate)
  const total = Math.max(0, base - absenceDeduction - lateDeduction - earlyDeduction)
  return { absenceDeduction, lateDeduction, earlyDeduction, total }
}

// Total *calculated* payroll (before ad-hoc deductions) for the given month.
// Pass the live staff list so added/removed/deactivated employees are counted.
export function payrollTotal(year, month, today, staffList = STAFF) {
  return staffList
    .filter((s) => s.active !== false)
    .reduce((sum, s) => {
      const att = monthAttendance(s.id, year, month, today)
      return sum + calcSalary(s.baseSalary, att.workingDays, att.present)
    }, 0)
}
