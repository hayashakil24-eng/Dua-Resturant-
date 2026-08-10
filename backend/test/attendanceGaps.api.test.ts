// GET /api/attendance/gaps — real per-day late-arrival/early-departure
// minutes, used by Payroll's per-minute deduction (see docs on
// calcNetSalary). Covers both shiftEndMode variants: a fixed checkout time,
// and "dayClosing" (Evening staff whose expected end is the restaurant's
// actual DailyClosing.closingTime for that date).

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/db/client.js'
import { seed } from '../prisma/seed.js'
import { toDayStr } from '../src/core/closing.js'

let app: FastifyInstance

async function tokenFor(username: string) {
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: '1234' } })
  return JSON.parse(res.body).token as string
}
function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
function todayAt(hh: number, mm: number): Date {
  const d = startOfToday()
  d.setHours(hh, mm, 0, 0)
  return d
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

describe('attendance gaps', () => {
  it('computes late/early minutes for a fixed-checkout employee', async () => {
    const staff = await prisma.staff.create({
      data: { name: 'Gap Test Fixed', role: 'Waiter', shift: 'Morning', shiftStartTime: '09:00', shiftEndTime: '17:00', shiftEndMode: 'fixed', active: true },
    })
    await prisma.attendanceRecord.create({
      data: { staffId: staff.id, date: startOfToday(), checkIn: todayAt(9, 20), checkOut: todayAt(16, 50), status: 'Checked Out', source: 'manual' },
    })

    const admin = await tokenFor('admin')
    const today = new Date()
    const res = await app.inject({
      method: 'GET',
      url: `/api/attendance/gaps?year=${today.getFullYear()}&month=${today.getMonth()}`,
      headers: auth(admin),
    })
    expect(res.statusCode).toBe(200)
    const { gaps } = JSON.parse(res.body)
    expect(gaps[staff.id].totalLateMinutes).toBe(20)
    expect(gaps[staff.id].totalEarlyMinutes).toBe(10)
    expect(gaps[staff.id].days).toHaveLength(1)
    expect(gaps[staff.id].days[0]).toMatchObject({ lateMinutes: 20, earlyMinutes: 10 })
  })

  it('computes early-leave against the actual DailyClosing time for "dayClosing" mode', async () => {
    const staff = await prisma.staff.create({
      data: { name: 'Gap Test DayClosing', role: 'Waiter', shift: 'Evening', shiftStartTime: '16:00', shiftEndTime: null, shiftEndMode: 'dayClosing', active: true },
    })
    const dateStr = toDayStr(new Date())
    // A closing this test creates directly (bypassing the real close flow —
    // this test only needs a closingTime row to compare against, not the
    // full precondition chain saveDailyClosing enforces).
    await prisma.dailyClosing.create({
      data: { date: dateStr, closedBy: 'Test', closedByRole: 'Admin', closingTime: todayAt(23, 0), totalSales: 0, reportJson: '{}' },
    })
    await prisma.attendanceRecord.create({
      data: { staffId: staff.id, date: startOfToday(), checkIn: todayAt(16, 5), checkOut: todayAt(22, 30), status: 'Checked Out', source: 'manual' },
    })

    const admin = await tokenFor('admin')
    const today = new Date()
    const res = await app.inject({
      method: 'GET',
      url: `/api/attendance/gaps?year=${today.getFullYear()}&month=${today.getMonth()}`,
      headers: auth(admin),
    })
    expect(res.statusCode).toBe(200)
    const { gaps } = JSON.parse(res.body)
    // 16:05 checkIn is only 5 minutes past a 16:00 start — inside the 15-min grace.
    expect(gaps[staff.id].totalLateMinutes).toBe(0)
    expect(gaps[staff.id].totalEarlyMinutes).toBe(30)
  })

  it('marks pre-hire days as notHired and scopes workingDays to real tenure', async () => {
    // A fixed past month (not "this month") so lastCounted is always the
    // whole month regardless of what day the test suite happens to run on —
    // deterministic without needing to fake the clock.
    const anchor = new Date()
    anchor.setDate(1)
    anchor.setMonth(anchor.getMonth() - 1)
    const year = anchor.getFullYear()
    const month = anchor.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const hireDate = new Date(year, month, 10)

    const staffMember = await prisma.staff.create({
      data: { name: 'Mid-Month Hire', role: 'Waiter', shift: 'Morning', shiftStartTime: '09:00', active: true, hireDate },
    })

    const admin = await tokenFor('admin')
    const res = await app.inject({
      method: 'GET',
      url: `/api/attendance/gaps?year=${year}&month=${month}`,
      headers: auth(admin),
    })
    expect(res.statusCode).toBe(200)
    const { gaps } = JSON.parse(res.body)
    const g = gaps[staffMember.id]

    // No attendance machine or manual override ever ran for this staff member
    // in that month — every day of their real tenure reads as a genuine
    // absence, not "notHired", and every day before hireDate reads the other
    // way around.
    expect(g.statusByDay[1]).toBe('notHired')
    expect(g.statusByDay[9]).toBe('notHired')
    expect(g.statusByDay[10]).toBe('absent')
    expect(g.statusByDay[daysInMonth]).toBe('absent')
    expect(Object.values(g.statusByDay)).not.toContain('off') // no weekly off day at this restaurant
    expect(g.fullWorkingDays).toBe(daysInMonth)
    expect(g.workingDays).toBe(daysInMonth - 10 + 1)
    expect(g.present).toBe(0)
    expect(g.absent).toBe(daysInMonth - 10 + 1)
  })

  it('rejects a missing/invalid year or month (400)', async () => {
    const admin = await tokenFor('admin')
    const res = await app.inject({ method: 'GET', url: '/api/attendance/gaps', headers: auth(admin) })
    expect(res.statusCode).toBe(400)
  })

  it('forbids a Cashier from reading payroll gaps (403)', async () => {
    const cashier = await tokenFor('cashier')
    const today = new Date()
    const res = await app.inject({
      method: 'GET',
      url: `/api/attendance/gaps?year=${today.getFullYear()}&month=${today.getMonth()}`,
      headers: auth(cashier),
    })
    expect(res.statusCode).toBe(403)
  })
})
