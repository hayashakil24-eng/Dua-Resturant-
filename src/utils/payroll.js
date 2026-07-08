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

  const workingDayNums = []
  const statusByDay = {}
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay()
    if (d > lastCounted) statusByDay[d] = 'upcoming'
    else if (dow === 0) statusByDay[d] = 'off'
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

// Total *calculated* payroll (before ad-hoc deductions) for the given month.
export function payrollTotal(year, month, today) {
  return STAFF.reduce((sum, s) => {
    const att = monthAttendance(s.id, year, month, today)
    return sum + calcSalary(s.baseSalary, att.workingDays, att.present)
  }, 0)
}
