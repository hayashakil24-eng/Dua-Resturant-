// Salary-paid record — per-employee-per-month, distinct from the Advance
// recovery flow (advances-recover.api.test.ts). Covers: marking paid mints a
// ledger expense and shows up in GET /api/payroll/paid; re-marking retracts
// and replaces that ledger row instead of orphaning it; unmarking removes
// both; a Cashier is forbidden from all three routes (payroll permission).

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/db/client.js'
import { seed } from '../prisma/seed.js'

let app: FastifyInstance

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}
async function tokenFor(username: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: '1234' } })
  return JSON.parse(res.body).token as string
}

beforeAll(async () => {
  await seed()
  app = buildApp()
  await app.ready()
})
afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describe('salary payments', () => {
  it('marks salary paid, mints a ledger expense, and lists it back', async () => {
    const staffMember = await prisma.staff.create({
      data: { name: 'Salary Test Staff', role: 'Waiter', shift: 'Morning', shiftStartTime: '09:00', active: true, baseSalary: 30000 },
    })
    const admin = await tokenFor('admin')
    const year = 2026
    const month = 6 // July (0-indexed) — the salary this payment covers
    const paidAt = '2026-08-05' // paid 5 Aug for July's salary

    const payRes = await app.inject({
      method: 'POST',
      url: `/api/payroll/${staffMember.id}/pay`,
      headers: auth(admin),
      payload: { year, month, amount: 23000, paidAt },
    })
    expect(payRes.statusCode).toBe(200)
    const { payment } = JSON.parse(payRes.body)
    expect(payment.amount).toBe(23000)
    expect(payment.paidBy).toBe('Malik Sahab')
    expect(payment.transactionId).toBeTruthy()

    const txn = await prisma.transaction.findUnique({ where: { id: payment.transactionId } })
    expect(txn?.category).toBe('Staff Salary')
    expect(txn?.amount).toBe(23000)

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/payroll/paid?year=${year}&month=${month}`,
      headers: auth(admin),
    })
    expect(listRes.statusCode).toBe(200)
    const { paid } = JSON.parse(listRes.body)
    expect(paid[staffMember.id].amount).toBe(23000)
  })

  it('re-marking retracts the old ledger row before minting the new one', async () => {
    const staffMember = await prisma.staff.create({
      data: { name: 'Salary Correction Staff', role: 'Waiter', shift: 'Morning', shiftStartTime: '09:00', active: true, baseSalary: 30000 },
    })
    const admin = await tokenFor('admin')
    const year = 2026
    const month = 6

    const first = await app.inject({
      method: 'POST',
      url: `/api/payroll/${staffMember.id}/pay`,
      headers: auth(admin),
      payload: { year, month, amount: 20000, paidAt: '2026-08-05' },
    })
    const firstTxnId = JSON.parse(first.body).payment.transactionId

    const second = await app.inject({
      method: 'POST',
      url: `/api/payroll/${staffMember.id}/pay`,
      headers: auth(admin),
      payload: { year, month, amount: 25000, paidAt: '2026-08-06' },
    })
    expect(second.statusCode).toBe(200)
    const { payment } = JSON.parse(second.body)
    expect(payment.amount).toBe(25000)
    expect(payment.transactionId).not.toBe(firstTxnId)

    const oldTxn = await prisma.transaction.findUnique({ where: { id: firstTxnId } })
    expect(oldTxn).toBeNull()

    const rows = await prisma.salaryPayment.findMany({ where: { staffId: staffMember.id, year, month } })
    expect(rows).toHaveLength(1)
  })

  it('unmarking removes both the payment record and its ledger row', async () => {
    const staffMember = await prisma.staff.create({
      data: { name: 'Salary Undo Staff', role: 'Waiter', shift: 'Morning', shiftStartTime: '09:00', active: true, baseSalary: 30000 },
    })
    const admin = await tokenFor('admin')
    const year = 2026
    const month = 6

    const payRes = await app.inject({
      method: 'POST',
      url: `/api/payroll/${staffMember.id}/pay`,
      headers: auth(admin),
      payload: { year, month, amount: 20000, paidAt: '2026-08-05' },
    })
    const { transactionId } = JSON.parse(payRes.body).payment

    const unpayRes = await app.inject({
      method: 'POST',
      url: `/api/payroll/${staffMember.id}/unpay`,
      headers: auth(admin),
      payload: { year, month },
    })
    expect(unpayRes.statusCode).toBe(200)

    const remaining = await prisma.salaryPayment.findMany({ where: { staffId: staffMember.id, year, month } })
    expect(remaining).toHaveLength(0)
    const txn = await prisma.transaction.findUnique({ where: { id: transactionId } })
    expect(txn).toBeNull()
  })

  it('forbids a Cashier from paying, unpaying, or reading salary payments (403)', async () => {
    const staffMember = await prisma.staff.create({
      data: { name: 'Salary Perm Staff', role: 'Waiter', shift: 'Morning', shiftStartTime: '09:00', active: true, baseSalary: 30000 },
    })
    const cashier = await tokenFor('cashier')

    const payRes = await app.inject({
      method: 'POST',
      url: `/api/payroll/${staffMember.id}/pay`,
      headers: auth(cashier),
      payload: { year: 2026, month: 6, amount: 20000 },
    })
    expect(payRes.statusCode).toBe(403)

    const unpayRes = await app.inject({
      method: 'POST',
      url: `/api/payroll/${staffMember.id}/unpay`,
      headers: auth(cashier),
      payload: { year: 2026, month: 6 },
    })
    expect(unpayRes.statusCode).toBe(403)

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/payroll/paid?year=2026&month=6',
      headers: auth(cashier),
    })
    expect(listRes.statusCode).toBe(403)
  })
})
