import { describe, expect, it } from 'vitest'
import { monthFigures } from '../src/core/accounting.js'
import type { StaffLike } from '../src/core/payroll.js'

describe('monthFigures', () => {
  it('scopes transactions to the given month and folds in live payroll as an expense', () => {
    const today = new Date(2026, 6, 18) // July 2026
    const transactions = [
      { type: 'income', amount: 620000, date: new Date(2026, 6, 6) },
      { type: 'expense', amount: 120000, date: new Date(2026, 6, 1) },
      { type: 'expense', amount: 45000, date: new Date(2026, 6, 4) },
      // Different month — must be excluded from inMonth/income/expense.
      { type: 'income', amount: 999999, date: new Date(2026, 5, 15) },
    ]
    const staff: StaffLike[] = [{ id: 'S01', active: true, baseSalary: 60000 }]

    const fig = monthFigures(transactions, 2026, 6, today, staff)

    expect(fig.inMonth).toHaveLength(3)
    expect(fig.income).toBe(620000)
    expect(fig.expense).toBe(120000 + 45000 + fig.payroll)
    expect(fig.profit).toBe(fig.income - fig.expense)
    expect(fig.margin).toBeCloseTo((fig.profit / fig.income) * 100, 6)
  })

  // An advance is salary paid early. It is booked as an expense on the day the
  // cash left the drawer, so the month's payroll must drop by the same amount
  // or the same rupee is charged twice.
  it('nets salary advances out of the month payroll instead of double-counting', () => {
    const today = new Date(2026, 6, 18)
    const staff: StaffLike[] = [{ id: 'S01', active: true, baseSalary: 60000 }]
    const base = monthFigures([], 2026, 6, today, staff)

    const withAdvance = monthFigures(
      [{ type: 'expense', amount: 10000, date: new Date(2026, 6, 9), category: 'Staff Advance' }],
      2026,
      6,
      today,
      staff,
    )

    expect(withAdvance.advances).toBe(10000)
    expect(withAdvance.payrollGross).toBe(base.payrollGross)
    expect(withAdvance.payroll).toBe(base.payrollGross - 10000)
    // The month's total is unchanged — the advance only moves money onto the
    // day it was actually paid, which is what makes it visible in daily reports.
    expect(withAdvance.expense).toBe(base.expense)
  })

  it('clamps payroll at 0 when advances exceed the calculated salary', () => {
    const today = new Date(2026, 6, 18)
    const staff: StaffLike[] = [{ id: 'S01', active: true, baseSalary: 60000 }]
    const fig = monthFigures(
      [{ type: 'expense', amount: 5_000_000, date: new Date(2026, 6, 9), category: 'Staff Advance' }],
      2026,
      6,
      today,
      staff,
    )
    expect(fig.payroll).toBe(0)
    expect(fig.expense).toBe(5_000_000)
  })

  it('reports margin 0 (not NaN/Infinity) when income is 0', () => {
    const today = new Date(2026, 6, 18)
    const fig = monthFigures([], 2026, 6, today, [])
    expect(fig.margin).toBe(0)
  })
})
