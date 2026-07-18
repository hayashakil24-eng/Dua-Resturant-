import type { FastifyInstance, FastifyRequest } from 'fastify'
import { requirePermission } from '../auth/guard.js'
import * as closing from '../services/closing.service.js'

export async function closingRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  // Preview a day's closing figures (built server-side).
  app.get('/api/closing/report', { preHandler: requirePermission('closing', 'access') }, async (req) => {
    const { date } = req.query as { date?: string }
    return { report: await closing.buildReport(date) }
  })
  app.get('/api/closings', { preHandler: requirePermission('closing', 'access') }, async () => ({ closings: await closing.listClosings() }))
  // Save an end-of-day snapshot (Admin/Manager).
  app.post('/api/closings', { preHandler: requirePermission('closing') }, async (req) => {
    const { date } = (req.body ?? {}) as { date?: string }
    return await closing.saveDailyClosing(ctx(req), date)
  })
}
