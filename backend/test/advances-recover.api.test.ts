// Advance recovery scoping: recovering with a staffId only marks THAT staff's
// pending advances recovered (their "Done" in the payroll modal); without a
// staffId the whole month is recovered (the payroll-confirm button).

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
async function statusOf(token: string, staffId: string) {
  const res = await app.inject({ method: 'GET', url: '/api/advances', headers: auth(token) })
  const adv = JSON.parse(res.body).advances.find((a: { staffId: string }) => a.staffId === staffId)
  return adv?.status as string
}

beforeAll(async () => {
  await seed()
  // Seed creates some demo advances; clear them so this test's two are the only
  // rows and statusOf() is unambiguous.
  await prisma.advance.deleteMany()
  app = buildApp()
  await app.ready()
})
afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describe('advance recovery scoping', () => {
  it('staffId-scoped recover only touches that staff; whole-month recover gets the rest', async () => {
    const admin = await tokenFor('admin')
    const date = '2026-07-15T00:00:00.000Z' // July 2026 → year 2026, monthIndex 6

    // Two staff (seeded S01 manager, S02 cashier) get a pending advance this month.
    for (const staffId of ['S01', 'S02']) {
      const r = await app.inject({ method: 'POST', url: '/api/advances', headers: auth(admin), payload: { staffId, amount: 200, reason: 'test', date } })
      expect(r.statusCode).toBe(200)
    }
    expect(await statusOf(admin, 'S01')).toBe('pending')
    expect(await statusOf(admin, 'S02')).toBe('pending')

    // Recover ONLY S01 (their "Done").
    const one = await app.inject({ method: 'POST', url: '/api/advances/recover', headers: auth(admin), payload: { year: 2026, monthIndex: 6, staffId: 'S01' } })
    expect(one.statusCode).toBe(200)
    expect(JSON.parse(one.body).recovered).toBe(1)
    expect(await statusOf(admin, 'S01')).toBe('recovered')
    expect(await statusOf(admin, 'S02')).toBe('pending') // untouched

    // Whole-month recover (payroll confirm) catches the remaining S02.
    const all = await app.inject({ method: 'POST', url: '/api/advances/recover', headers: auth(admin), payload: { year: 2026, monthIndex: 6 } })
    expect(all.statusCode).toBe(200)
    expect(await statusOf(admin, 'S02')).toBe('recovered')
  })
})
