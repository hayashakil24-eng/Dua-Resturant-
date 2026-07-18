// Ported from frontend/src/utils/accounting.js — income & expense totals for
// one month. Staff payroll is pulled live from payroll.ts so Accounting and
// Reports always agree, same as the frontend.

import { payrollTotal, type StaffLike } from './payroll.js'

export interface TransactionLike {
  type: string // 'income' | 'expense'
  amount: number
  date: Date | string
}

export interface MonthFigures<T extends TransactionLike> {
  inMonth: T[]
  payroll: number
  income: number
  expense: number
  profit: number
  margin: number
}

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
  const payroll = payrollTotal(year, monthIndex, today, staffList)

  const income = manualIncome
  const expense = manualExpense + payroll
  const profit = income - expense
  const margin = income > 0 ? (profit / income) * 100 : 0
  return { inMonth, payroll, income, expense, profit, margin }
}
