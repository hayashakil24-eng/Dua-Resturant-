import { describe, expect, it } from 'vitest'
import { calcSalary, monthAttendance, payrollTotal, type StaffLike } from '../src/core/payroll.js'

describe('calcSalary', () => {
  it('prorates base salary by present/workingDays', () => {
    // Rs.60,000 base, 26 working days, present 24 -> 60000/26*24, rounded.
    expect(calcSalary(60000, 26, 24)).toBe(Math.round((60000 / 26) * 24))
  })

  it('returns 0 when there were no working days (avoids divide-by-zero)', () => {
    expect(calcSalary(60000, 0, 0)).toBe(0)
  })
})

describe('monthAttendance (Phase-0 placeholder — see TODO in payroll.ts)', () => {
  it('is deterministic: same staffId/year/month/today always produces the same result', () => {
    const today = new Date(2026, 6, 18)
    const a = monthAttendance('S01', 2026, 6, today)
    const b = monthAttendance('S01', 2026, 6, today)
    expect(a).toEqual(b)
  })

  it('never marks more than 3 working days absent, and present+absent = workingDays', () => {
    const today = new Date(2026, 6, 18)
    const result = monthAttendance('S02', 2026, 6, today)
    expect(result.absent).toBeLessThanOrEqual(3)
    expect(result.present + result.absent).toBe(result.workingDays)
  })
})

describe('payrollTotal', () => {
  it('sums calcSalary across active staff only, skipping inactive ones', () => {
    const today = new Date(2026, 6, 18)
    const staff: StaffLike[] = [
      { id: 'S01', active: true, baseSalary: 60000 },
      { id: 'S02', active: false, baseSalary: 38000 }, // excluded
    ]
    const total = payrollTotal(2026, 6, today, staff)
    const att = monthAttendance('S01', 2026, 6, today)
    expect(total).toBe(calcSalary(60000, att.workingDays, att.present))
  })
})
