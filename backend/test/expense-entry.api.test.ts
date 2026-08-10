// Cashier quick-add-expense: 'expenseEntry' is a narrow create-only slice of
// 'accounting' (POST /api/transactions only) — Cashier must never see or
// delete the ledger (GET/DELETE stay 403), and must never smuggle in an
// income row even if the request body asks for one. Also covers the
// Maintenance-only subCategory/vendor fields added alongside it.

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

describe('expenseEntry permission on POST /api/transactions', () => {
  it('lets a Cashier add an expense, but still forbids GET (list) and DELETE', async () => {
    const cashier = await tokenFor('cashier')

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/transactions',
      headers: auth(cashier),
      payload: { type: 'expense', category: 'Utilities', description: 'Electricity bill', amount: 4500 },
    })
    expect(postRes.statusCode).toBe(200)
    const { transaction } = JSON.parse(postRes.body)
    expect(transaction.amount).toBe(4500)

    const getRes = await app.inject({ method: 'GET', url: '/api/transactions', headers: auth(cashier) })
    expect(getRes.statusCode).toBe(403)

    const deleteRes = await app.inject({ method: 'DELETE', url: `/api/transactions/${transaction.id}`, headers: auth(cashier) })
    expect(deleteRes.statusCode).toBe(403)
  })

  it('forces type to "expense" for a Cashier even if the body asks for income', async () => {
    const cashier = await tokenFor('cashier')

    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions',
      headers: auth(cashier),
      payload: { type: 'income', category: 'Sales', description: 'attempted income entry', amount: 100000 },
    })
    expect(res.statusCode).toBe(200)
    const { transaction } = JSON.parse(res.body)
    expect(transaction.type).toBe('expense')
  })

  it('still lets Admin/Manager post income and read/delete the ledger as before', async () => {
    const admin = await tokenFor('admin')

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/transactions',
      headers: auth(admin),
      payload: { type: 'income', category: 'Catering', description: 'Event catering', amount: 50000 },
    })
    expect(postRes.statusCode).toBe(200)
    const { transaction } = JSON.parse(postRes.body)
    expect(transaction.type).toBe('income')

    const getRes = await app.inject({ method: 'GET', url: '/api/transactions', headers: auth(admin) })
    expect(getRes.statusCode).toBe(200)

    const deleteRes = await app.inject({ method: 'DELETE', url: `/api/transactions/${transaction.id}`, headers: auth(admin) })
    expect(deleteRes.statusCode).toBe(200)
  })
})

describe('Maintenance subCategory/vendor', () => {
  it('stores subCategory/vendor for a Maintenance-category transaction', async () => {
    const admin = await tokenFor('admin')
    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions',
      headers: auth(admin),
      payload: {
        type: 'expense',
        category: 'Cafe Ali Maintenance',
        description: 'Fixed the generator',
        amount: 3000,
        subCategory: 'labour',
        vendor: 'Saleem Carpenter',
      },
    })
    expect(res.statusCode).toBe(200)
    const { transaction } = JSON.parse(res.body)
    expect(transaction.subCategory).toBe('labour')
    expect(transaction.vendor).toBe('Saleem Carpenter')
  })

  it('ignores subCategory/vendor for a non-Maintenance category', async () => {
    const admin = await tokenFor('admin')
    const res = await app.inject({
      method: 'POST',
      url: '/api/transactions',
      headers: auth(admin),
      payload: { type: 'expense', category: 'Rent', description: 'Monthly rent', amount: 20000, subCategory: 'labour', vendor: 'Someone' },
    })
    expect(res.statusCode).toBe(200)
    const { transaction } = JSON.parse(res.body)
    expect(transaction.subCategory).toBeNull()
    expect(transaction.vendor).toBeNull()
  })
})

describe('Advance deductFromSalaryDate', () => {
  it('round-trips an optional deductFromSalaryDate', async () => {
    const admin = await tokenFor('admin')
    const res = await app.inject({
      method: 'POST',
      url: '/api/advances',
      headers: auth(admin),
      payload: { staffId: 'S01', amount: 5000, reason: 'test', date: '2026-07-15T00:00:00.000Z', deductFromSalaryDate: '2026-08-01T00:00:00.000Z' },
    })
    expect(res.statusCode).toBe(200)
    const { advance } = JSON.parse(res.body)
    expect(new Date(advance.deductFromSalaryDate).toISOString().slice(0, 10)).toBe('2026-08-01')
  })

  it('leaves deductFromSalaryDate null when not provided', async () => {
    const admin = await tokenFor('admin')
    const res = await app.inject({
      method: 'POST',
      url: '/api/advances',
      headers: auth(admin),
      payload: { staffId: 'S01', amount: 1000, reason: 'no deduct date', date: '2026-07-15T00:00:00.000Z' },
    })
    expect(res.statusCode).toBe(200)
    const { advance } = JSON.parse(res.body)
    expect(advance.deductFromSalaryDate).toBeNull()
  })
})
