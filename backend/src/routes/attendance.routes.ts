import type { FastifyInstance, FastifyRequest } from 'fastify'
import { requirePermission } from '../auth/guard.js'
import * as attendance from '../services/attendance.service.js'
import { ServiceError } from '../lib/errors.js'

export async function attendanceRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  app.get('/api/attendance', { preHandler: requirePermission('attendance', 'access') }, async () => ({ attendance: await attendance.listAttendance() }))
  // Real per-day late/early minutes for a month — Payroll's per-minute deduction.
  app.get('/api/attendance/gaps', { preHandler: requirePermission('payroll', 'access') }, async (req) => {
    const { year, month } = req.query as { year?: string; month?: string }
    const y = Number(year)
    const m = Number(month)
    if (!Number.isFinite(y) || !Number.isFinite(m)) throw new ServiceError('A valid year and month are required.')
    return { gaps: await attendance.getMonthlyAttendanceGaps(y, m) }
  })
  // Admin/Manager emergency manual override (attendanceOverride).
  app.post('/api/attendance/:staffId/override', { preHandler: requirePermission('attendanceOverride') }, async (req) => {
    const { staffId } = req.params as { staffId: string }
    const { checkIn, checkOut, reason, notes } = (req.body ?? {}) as { checkIn?: string; checkOut?: string; reason?: string; notes?: string }
    return { record: await attendance.overrideAttendance(ctx(req), staffId, { checkIn, checkOut, reason, notes }) }
  })
}
