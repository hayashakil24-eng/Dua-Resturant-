import { payrollTotal } from './payroll.js'

// "Cafe Ali Maintenance" is tracked as its own bucket, separate from other
// expenses (own breakdown box + its own report line). Old rows saved as plain
// "Maintenance" (before the rename) still count as maintenance.
export const MAINTENANCE_CATEGORY = 'Cafe Ali Maintenance'
export const isMaintenance = (cat) => cat === MAINTENANCE_CATEGORY || cat === 'Maintenance'

// Ledger rows minted by other flows rather than typed into the Accounting form.
// They are ordinary expenses everywhere — routing stock purchases and salary
// advances through the same Transaction table is what makes them show up in the
// daily/monthly reports without every report learning about them.
export const PURCHASE_CATEGORY = 'Inventory Purchase'
export const ADVANCE_CATEGORY = 'Staff Advance'
export const isPurchase = (cat) => cat === PURCHASE_CATEGORY
export const isAdvance = (cat) => cat === ADVANCE_CATEGORY

// Total order value for one payment status in a period. Income uses 'Paid'
// (actual POS sales); pass 'Udhaar' for on-account credit. `inPeriod(date)`
// scopes it to a day/month; cancelled orders are excluded.
export function periodSales(orders, orderTotal, inPeriod, payment = 'Paid') {
  return (orders || [])
    .filter((o) => o.payment === payment && !o.cancelled && inPeriod(new Date(o.createdAt)))
    .reduce((s, o) => s + orderTotal(o.items, o.discount?.amount, o.gstRate).total, 0)
}

// Income & expense totals for one month. Income is the month's paid-order sales;
// expenses are manual expense entries + live payroll. Shared by Accounting and
// Reports so both agree.
export function monthFigures(transactions, orders, orderTotal, year, monthIndex, today, staffList) {
  const inMonth = transactions.filter((tx) => {
    const d = new Date(tx.date)
    return d.getFullYear() === year && d.getMonth() === monthIndex
  })
  const inPeriod = (d) => d.getFullYear() === year && d.getMonth() === monthIndex
  const sales = periodSales(orders, orderTotal, inPeriod)
  const udhaar = periodSales(orders, orderTotal, inPeriod, 'Udhaar')
  // Maintenance is split out from the other expenses.
  const maintenance = inMonth
    .filter((t) => t.type === 'expense' && isMaintenance(t.category))
    .reduce((s, t) => s + t.amount, 0)
  const otherExpense = inMonth
    .filter((t) => t.type === 'expense' && !isMaintenance(t.category))
    .reduce((s, t) => s + t.amount, 0)

  // Salary advances are already inside otherExpense (booked as a ledger row on
  // the day the cash was handed over). An advance is salary paid *early*, not
  // extra pay, so the month's calculated payroll is reduced by the same amount
  // — otherwise a Rs 10,000 advance against a Rs 30,000 salary would book
  // Rs 40,000. Clamped at 0 for the case where advances exceed the month's
  // calculated salary. The month's total is unchanged by this split; it only
  // moves the money onto the day it actually left the drawer, which is what
  // makes it visible in the daily report.
  const advances = inMonth
    .filter((t) => t.type === 'expense' && isAdvance(t.category))
    .reduce((s, t) => s + t.amount, 0)
  const payrollGross = payrollTotal(year, monthIndex, today, staffList)
  const payroll = Math.max(0, payrollGross - advances)

  const income = sales
  const expense = otherExpense + payroll // excludes maintenance (shown separately)
  const profit = income - expense - maintenance
  const margin = income > 0 ? (profit / income) * 100 : 0
  return { inMonth, sales, udhaar, maintenance, payroll, payrollGross, advances, income, expense, profit, margin }
}
