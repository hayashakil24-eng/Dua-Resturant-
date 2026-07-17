import { payrollTotal } from './payroll.js'

// Income & expense totals for one month. Staff payroll is pulled live from the
// shared payroll util so Accounting and Reports always agree.
// Shared by the Accounting page and the Reports page.
export function monthFigures(transactions, year, monthIndex, today, staffList) {
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
