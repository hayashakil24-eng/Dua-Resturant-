// Self-signup + admin approval flow: signup creates a pending Staff row with
// no login role yet, a pending account can log in (role 'Pending') to see a
// waiting screen but is locked out of everything else, and only Admin can
// approve (assign a real role) or reject a request. Same harness as
// domains.api.test.ts (shared dev DB, real HTTP stack via app.inject).

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/db/client.js'
import { seed } from '../prisma/seed.js'

let app: FastifyInstance
const tokens: Record<string, string> = {}

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}
async function tokenFor(username: string, password = '1234') {
  const key = `${username}:${password}`
  if (tokens[key]) return tokens[key]!
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password } })
  tokens[key] = JSON.parse(res.body).token
  return tokens[key]!
}
function post(url: string, token?: string, payload?: unknown) {
  return app.inject({ method: 'POST', url, headers: token ? auth(token) : undefined, payload: payload as object })
}
function get(url: string, token: string) {
  return app.inject({ method: 'GET', url, headers: auth(token) })
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

describe('self-signup', () => {
  it('creates a pending account and returns no token', async () => {
    const res = await post('/api/auth/signup', undefined, { name: 'New Hire', username: 'newhire1', password: 'hunter2' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toEqual({ ok: true })
    expect(body.token).toBeUndefined()
  })

  it('rejects a duplicate username with 409', async () => {
    await post('/api/auth/signup', undefined, { name: 'Dup', username: 'dupuser', password: 'hunter2' })
    const res = await post('/api/auth/signup', undefined, { name: 'Dup Again', username: 'dupuser', password: 'hunter2' })
    expect(res.statusCode).toBe(409)
  })
})

describe('pending account: can log in, locked out of everything else', () => {
  it('logs in with role Pending', async () => {
    await post('/api/auth/signup', undefined, { name: 'Waiting Room', username: 'waitingroom1', password: 'hunter2' })
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'waitingroom1', password: 'hunter2' } })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.user.role).toBe('Pending')
    expect(body.token).toBeTruthy()
  })

  it('can still call /api/auth/me and /api/auth/logout', async () => {
    await post('/api/auth/signup', undefined, { name: 'Selfcheck', username: 'selfcheck1', password: 'hunter2' })
    const token = await tokenFor('selfcheck1', 'hunter2')
    const me = await get('/api/auth/me', token)
    expect(me.statusCode).toBe(200)
    expect(JSON.parse(me.body).user.role).toBe('Pending')

    const logout = await post('/api/auth/logout', token)
    expect(logout.statusCode).toBe(200)
  })

  it('gets 403 on a bare-authenticate route with no page-permission check (regression: pending JWTs must not read broad data)', async () => {
    await post('/api/auth/signup', undefined, { name: 'Snooper', username: 'snooper1', password: 'hunter2' })
    const token = await tokenFor('snooper1', 'hunter2')
    const res = await get('/api/staff', token)
    expect(res.statusCode).toBe(403)
  })

  it('gets 403 on a requirePermission-gated route too', async () => {
    await post('/api/auth/signup', undefined, { name: 'Snooper2', username: 'snooper2', password: 'hunter2' })
    const token = await tokenFor('snooper2', 'hunter2')
    const res = await post('/api/staff', token, { name: 'x' })
    expect(res.statusCode).toBe(403)
  })
})

describe('approval queue: Admin-only', () => {
  it('Manager is forbidden from the pending-signups list; Admin sees it', async () => {
    await post('/api/auth/signup', undefined, { name: 'Queue Test', username: 'queuetest1', password: 'hunter2' })

    const managerDenied = await get('/api/staff/pending-signups', await tokenFor('manager'))
    expect(managerDenied.statusCode).toBe(403)

    const adminList = await get('/api/staff/pending-signups', await tokenFor('admin'))
    expect(adminList.statusCode).toBe(200)
    const { pendingSignups } = JSON.parse(adminList.body)
    expect(pendingSignups.some((s: { username: string }) => s.username === 'queuetest1')).toBe(true)
  })

  it('approving assigns a role and status approved; the account can then log in with real access', async () => {
    await post('/api/auth/signup', undefined, { name: 'Approve Me', username: 'approveme1', password: 'hunter2' })
    const adminList = await get('/api/staff/pending-signups', await tokenFor('admin'))
    const row = JSON.parse(adminList.body).pendingSignups.find((s: { username: string }) => s.username === 'approveme1')

    const approve = await post(`/api/staff/${row.id}/approve-signup`, await tokenFor('admin'), { systemRole: 'Cashier' })
    expect(approve.statusCode).toBe(200)
    const approved = JSON.parse(approve.body).staff
    expect(approved.systemRole).toBe('Cashier')
    expect(approved.status).toBe('approved')
    // role (job-title column in the Employees table) must be promoted off the
    // 'Pending' placeholder, not left stale.
    expect(approved.role).toBe('Cashier')

    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'approveme1', password: 'hunter2' } })
    expect(login.statusCode).toBe(200)
    expect(JSON.parse(login.body).user.role).toBe('Cashier')
  })

  it('rejecting blocks login with a clear message; Manager cannot reject', async () => {
    await post('/api/auth/signup', undefined, { name: 'Reject Me', username: 'rejectme1', password: 'hunter2' })
    const adminList = await get('/api/staff/pending-signups', await tokenFor('admin'))
    const row = JSON.parse(adminList.body).pendingSignups.find((s: { username: string }) => s.username === 'rejectme1')

    const managerDenied = await post(`/api/staff/${row.id}/reject-signup`, await tokenFor('manager'), { reason: 'no' })
    expect(managerDenied.statusCode).toBe(403)

    const reject = await post(`/api/staff/${row.id}/reject-signup`, await tokenFor('admin'), { reason: 'Not a real employee' })
    expect(reject.statusCode).toBe(200)

    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'rejectme1', password: 'hunter2' } })
    expect(login.statusCode).toBe(403)
    expect(JSON.parse(login.body).error).toMatch(/not approved/i)
  })
})
