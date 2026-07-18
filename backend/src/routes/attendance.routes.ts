import type { FastifyInstance, FastifyRequest } from 'fastify'
import { requirePermission } from '../auth/guard.js'
import * as attendance from '../services/attendance.service.js'

export async function attendanceRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  app.get('/api/attendance', { preHandler: requirePermission('attendance', 'access') }, async () => ({ attendance: await attendance.listAttendance() }))
  // Admin-only emergency manual override (attendanceOverride).
  app.post('/api/attendance/:staffId/override', { preHandler: requirePermission('attendanceOverride') }, async (req) => {
    const { staffId } = req.params as { staffId: string }
    const { checkIn, checkOut, reason, notes } = (req.body ?? {}) as { checkIn?: string; checkOut?: string; reason?: string; notes?: string }
    return { record: await attendance.overrideAttendance(ctx(req), staffId, { checkIn, checkOut, reason, notes }) }
  })
}
