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

// Cash is signed for by the role it was handed to. Both Admin and Manager hold
// the 'handovers' permission, so without an addressed-role check approval was
// effectively "whoever clicks first" and the accepted record named the wrong
// holder. Runs in order: the Manager ends up holding 1,100 for the forward
// tests below, the Admin 500.
describe('handover approval is limited to the addressed role', () => {
  it('refuses a Manager approving cash addressed to the Admin, and lets an Admin approve it', async () => {
    const cashier = await tokenFor('cashier')
    const started = await post('/api/shifts/start', cashier, { openingCash: 500 })
    const shiftId = JSON.parse(started.body).shift.id as string
    const ended = await post(`/api/shifts/${shiftId}/end`, cashier, {
      actualCash: 500,
      handover: { to: 'Admin', name: 'Admin' },
    })
    expect(ended.statusCode).toBe(200)

    const listed = await get('/api/handovers', cashier)
    const ho = JSON.parse(listed.body).handovers.find(
      (h: { shiftId: string; kind: string }) => h.shiftId === shiftId && h.kind === 'shift_end',
    )
    expect(ho.toRole).toBe('Admin')

    const manager = await tokenFor('manager')
    const denied = await post(`/api/handovers/${ho.id}/accept`, manager)
    expect(denied.statusCode).toBe(403)

    const admin = await tokenFor('admin')
    const ok = await post(`/api/handovers/${ho.id}/accept`, admin)
    expect(ok.statusCode).toBe(200)
    expect(JSON.parse(ok.body).handover.status).toBe('accepted')
  })

  it('refuses a handover addressed to a role that could never accept it, without closing the shift', async () => {
    const cashier = await tokenFor('cashier')
    const started = await post('/api/shifts/start', cashier, { openingCash: 100 })
    const shiftId = JSON.parse(started.body).shift.id as string

    // 'Other' is what the shift-end modal used to send for a named person —
    // no role matches it, so the cash could never be signed for.
    const bad = await post(`/api/shifts/${shiftId}/end`, cashier, {
      actualCash: 100,
      handover: { to: 'Other', name: 'Waiter Ali' },
    })
    expect(bad.statusCode).toBe(400)

    // Validation runs before any write — the drawer is still open.
    const active = JSON.parse((await get('/api/shifts/active', cashier)).body).shift
    expect(active?.id).toBe(shiftId)

    // Close it properly so the Manager holds 1,000 + 100 for the tests below.
    const good = await post(`/api/shifts/${shiftId}/end`, cashier, {
      actualCash: 100,
      handover: { to: 'Manager', name: 'Haya' },
    })
    expect(good.statusCode).toBe(200)
    const ho = JSON.parse((await get('/api/handovers', cashier)).body).handovers.find(
      (h: { shiftId: string; kind: string }) => h.shiftId === shiftId && h.kind === 'shift_end',
    )
    expect((await post(`/api/handovers/${ho.id}/accept`, await tokenFor('manager'))).statusCode).toBe(200)
  })
})

// Cash flows Cashier → Manager/Admin → Admin, so everything ends in one pair of
// hands. The Manager leg has no drawer behind it, so the cap is what they are
// actually still holding.
describe('manager forwards collected cash to the admin', () => {
  it('caps the forward at the cash the manager holds and routes approval to the Admin', async () => {
    const manager = await tokenFor('manager')

    const tooMuch = await post('/api/handovers/forward', manager, { amount: 999999 })
    expect(tooMuch.statusCode).toBe(400)

    const sent = await post('/api/handovers/forward', manager, { amount: 600, reason: 'to owner' })
    expect(sent.statusCode).toBe(200)
    const ho = JSON.parse(sent.body).handover
    expect(ho.toRole).toBe('Admin')
    expect(ho.fromRole).toBe('Manager')
    expect(ho.shiftId).toBeNull() // a manager runs no drawer
    expect(ho.kind).toBe('forward')

    // The manager who sent it cannot sign for it themselves.
    expect((await post(`/api/handovers/${ho.id}/accept`, manager)).statusCode).toBe(403)

    const admin = await tokenFor('admin')
    expect((await post(`/api/handovers/${ho.id}/accept`, admin)).statusCode).toBe(200)

    // Forwarded cash left the manager's hands: 1,100 in, 600 out → 500 left.
    const stillTooMuch = await post('/api/handovers/forward', manager, { amount: 501 })
    expect(stillTooMuch.statusCode).toBe(400)
    expect((await post('/api/handovers/forward', manager, { amount: 500 })).statusCode).toBe(200)
  })

  it('refuses forwarding from a Cashier or an Admin (Admin is the final destination)', async () => {
    expect((await post('/api/handovers/forward', await tokenFor('cashier'), { amount: 10 })).statusCode).toBe(403)
    expect((await post('/api/handovers/forward', await tokenFor('admin'), { amount: 10 })).statusCode).toBe(403)
  })
})

// Cash positions are confidential up the chain: a Manager must not be able to
// read what the Admin is holding. Hiding it in the UI alone would still ship
// the numbers to their device, so /api/handovers scopes its own response.
// Display names of the seeded demo logins (prisma/seed.ts).
const MANAGER = 'Ali Raza'
const CASHIER = 'Hamza Khan'

describe('handover visibility is scoped to the caller', () => {
  it('hides the Admin cash position from a Manager, and a cashier sees only their own', async () => {
    const admin = await tokenFor('admin')
    const manager = await tokenFor('manager')
    const cashier = await tokenFor('cashier')

    const all = JSON.parse((await get('/api/handovers', admin)).body).handovers
    const mgr = JSON.parse((await get('/api/handovers', manager)).body).handovers
    const csh = JSON.parse((await get('/api/handovers', cashier)).body).handovers

    // The Rs.500 drawer went to the Admin and was signed for by the Admin —
    // the Manager must not see it at all, or its amount is readable.
    const adminDrawer = all.find(
      (h: { kind: string; toRole: string; amount: number }) =>
        h.kind === 'shift_end' && h.toRole === 'Admin' && h.amount === 500,
    )
    expect(adminDrawer.status).toBe('accepted')
    expect(mgr.some((m: { id: string }) => m.id === adminDrawer.id)).toBe(false)
    // ...but the cashier who handed it over still sees its status.
    expect(csh.some((c: { id: string }) => c.id === adminDrawer.id)).toBe(true)

    // Everything the Manager does see is their own business.
    expect(mgr.length).toBeGreaterThan(0)
    expect(mgr.length).toBeLessThan(all.length)
    expect(
      mgr.every(
        (h: { resolvedBy: string; fromName: string; status: string; toRole: string }) =>
          h.resolvedBy === MANAGER ||
          h.fromName === MANAGER ||
          (h.status === 'pending' && h.toRole === 'Manager'),
      ),
    ).toBe(true)

    // A cashier only ever sees what they handed over themselves.
    expect(csh.length).toBeGreaterThan(0)
    expect(csh.every((h: { fromName: string }) => h.fromName === CASHIER)).toBe(true)
  })
})
