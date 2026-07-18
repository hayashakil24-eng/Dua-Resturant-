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

  it('reports margin 0 (not NaN/Infinity) when income is 0', () => {
    const today = new Date(2026, 6, 18)
    const fig = monthFigures([], 2026, 6, today, [])
    expect(fig.margin).toBe(0)
  })
})
