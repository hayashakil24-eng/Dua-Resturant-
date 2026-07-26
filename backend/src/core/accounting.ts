// Ported from frontend/src/utils/accounting.js — income & expense totals for
// one month. Staff payroll is pulled live from payroll.ts so Accounting and
// Reports always agree, same as the frontend.

import { payrollTotal, type StaffLike } from './payroll.js'

export interface TransactionLike {
  type: string // 'income' | 'expense'
  amount: number
  date: Date | string
  category?: string
}

export interface MonthFigures<T extends TransactionLike> {
  inMonth: T[]
  payroll: number
  payrollGross: number
  advances: number
  income: number
  expense: number
  profit: number
  margin: number
}

// Ledger category minted by staff.service.ts when an advance is handed over.
// Kept in sync with frontend/src/utils/accounting.js.
export const ADVANCE_CATEGORY = 'Staff Advance'

export function monthFigures<T extends TransactionLike>(
  transactions: T[],
  year: number,
  monthIndex: number,
  today: Date,
  staffList: StaffLike[],
): MonthFigures<T> {
  const inMonth = transactions.filter((tx) => {
    const d = new Date(tx.date)
    return d.getFullYear() === year && d.getMonth() === monthIndex
  })
  const manualIncome = inMonth
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)
  const manualExpense = inMonth
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)
  // Advances are already counted inside manualExpense (booked on the day the
  // cash left the drawer). An advance is salary paid early, not extra pay, so
  // the month's calculated payroll is reduced by the same amount — otherwise a
  // Rs 10,000 advance against a Rs 30,000 salary would book Rs 40,000. Clamped
  // at 0 for the case where advances exceed the calculated salary.
  const advances = inMonth
    .filter((t) => t.type === 'expense' && t.category === ADVANCE_CATEGORY)
    .reduce((s, t) => s + t.amount, 0)
  const payrollGross = payrollTotal(year, monthIndex, today, staffList)
  const payroll = Math.max(0, payrollGross - advances)

  const income = manualIncome
  const expense = manualExpense + payroll
  const profit = income - expense
  const margin = income > 0 ? (profit / income) * 100 : 0
  return { inMonth, payroll, payrollGross, advances, income, expense, profit, margin }
}
