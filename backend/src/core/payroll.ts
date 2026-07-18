// Ported from frontend/src/utils/payroll.js.
//
// `calcSalary` is permanent, real business logic (the salary proration
// formula) — ported unchanged.
//
// `monthAttendance` is NOT permanent: the frontend file's own comment says
// "Attendance is deterministic mock data (stable per staff + month); swap
// monthAttendance() for a real query when wired." It was a placeholder
// because no real attendance data existed yet. Phase 0 now has a real
// AttendanceRecord model (schema.prisma) — Phase 1, when it wires up actual
// DB-backed routes, should replace this function's body with a real query
// against AttendanceRecord and delete the RNG generator below. Ported as-is
// for now only so `payrollTotal`/`accounting.ts` have something to call
// during this phase's smoke tests, not because it's meant to ship.

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface MonthAttendance {
  daysInMonth: number
  workingDays: number
  present: number
  absent: number
  statusByDay: Record<number, 'upcoming' | 'off' | 'present' | 'absent'>
}

// TODO(Phase 1): replace this body with a real query against AttendanceRecord.
export function monthAttendance(staffId: string, year: number, month: number, today: Date): MonthAttendance {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()
  const lastCounted = isCurrentMonth ? today.getDate() : daysInMonth

  const seedNum = Number(staffId.replace(/\D/g, '')) * 1000 + year * 13 + month
  const rng = mulberry32(seedNum)

  const workingDayNums: number[] = []
  const statusByDay: MonthAttendance['statusByDay'] = {}
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
  for (let i = 0; i < numAbsent; i++) {
    const day = shuffled[i]
    if (day !== undefined) statusByDay[day] = 'absent'
  }

  const workingDays = workingDayNums.length
  return {
    daysInMonth,
    workingDays,
    present: workingDays - numAbsent,
    absent: numAbsent,
    statusByDay,
  }
}

export function calcSalary(base: number, workingDays: number, present: number): number {
  return workingDays > 0 ? Math.round((base / workingDays) * present) : 0
}

export interface StaffLike {
  id: string
  active: boolean
  baseSalary: number
}

// `staffList` has no default here (the frontend defaulted to the static
// mockData STAFF array) — the backend always has a real list to pass in.
export function payrollTotal(year: number, month: number, today: Date, staffList: StaffLike[]): number {
  return staffList
    .filter((s) => s.active !== false)
    .reduce((sum, s) => {
      const att = monthAttendance(s.id, year, month, today)
      return sum + calcSalary(s.baseSalary, att.workingDays, att.present)
    }, 0)
}
