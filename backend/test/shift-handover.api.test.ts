// Shift-end cash handover → approval. Ending a shift with a recipient must
// create a PendingHandover (kind:'shift_end', pending) so a Manager/Admin
// confirms receipt — AND accepting it must NOT change the closed shift's
// reconciliation (a whole-drawer handover isn't a mid-shift deduction).

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
async function post(url: string, token: string, payload?: unknown) {
  return app.inject({ method: 'POST', url, headers: auth(token), payload: payload ?? {} })
}
async function get(url: string, token: string) {
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

describe('shift-end handover approval', () => {
  it('creates a pending shift_end handover on end, and accepting it does not alter the shift', async () => {
    const cashier = await tokenFor('cashier')

    // Open a drawer with Rs.1000 and immediately close it, handing the counted
    // Rs.1000 to the Manager (no orders → expected == opening == actual).
    const started = await post('/api/shifts/start', cashier, { openingCash: 1000 })
    expect(started.statusCode).toBe(200)
    const shiftId = JSON.parse(started.body).shift.id as string

    const ended = await post(`/api/shifts/${shiftId}/end`, cashier, {
      actualCash: 1000,
      handover: { to: 'Manager', name: 'Haya', reason: 'end of shift' },
    })
    expect(ended.statusCode).toBe(200)
    expect(JSON.parse(ended.body).shift.status).toBe('matched')

    // A pending shift_end handover for the full counted drawer now exists.
    const listed = await get('/api/handovers', cashier)
    const ho = JSON.parse(listed.body).handovers.find(
      (h: { shiftId: string; kind: string }) => h.shiftId === shiftId && h.kind === 'shift_end',
    )
    expect(ho).toBeTruthy()
    expect(ho.status).toBe('pending')
    expect(ho.amount).toBe(1000)
    expect(ho.fromName).toBe('Hamza Khan') // seeded `cashier` account's display name
    expect(ho.toName).toBe('Haya')

    // Reconciliation before approval.
    const before = JSON.parse((await get(`/api/shifts/${shiftId}/sales`, cashier)).body).sales
    expect(before.expectedCash).toBe(1000)
    expect(before.handedOver).toBe(0)

    // Manager accepts the drawer handover.
    const manager = await tokenFor('manager')
    const accepted = await post(`/api/handovers/${ho.id}/accept`, manager)
    expect(accepted.statusCode).toBe(200)
    expect(JSON.parse(accepted.body).handover.status).toBe('accepted')

    // Accepting a shift_end handover must NOT be subtracted from the drawer —
    // expectedCash/handedOver are unchanged (the kind filter in computeSales).
    const after = JSON.parse((await get(`/api/shifts/${shiftId}/sales`, cashier)).body).sales
    expect(after.expectedCash).toBe(1000)
    expect(after.handedOver).toBe(0)
  })
})
