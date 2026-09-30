import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticate, requirePermission } from '../auth/guard.js'
import * as closing from '../services/closing.service.js'

export async function closingRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  // Preview a day's closing figures (built server-side).
  app.get('/api/closing/report', { preHandler: requirePermission('closing', 'access') }, async (req) => {
    const { date } = req.query as { date?: string }
    return { report: await closing.buildReport(date) }
  })
  app.get('/api/closings', { preHandler: requirePermission('closing', 'access') }, async () => ({ closings: await closing.listClosings() }))
  // Just the boundary timestamp, open to every authenticated role (not gated
  // behind the 'closing' permission) — Cashier-visible pages need this to know
  // where the current session starts, without seeing the full financial report.
  app.get('/api/closings/latest', { preHandler: authenticate }, async () => {
    const latest = await closing.getLatestClosing()
    return { closingTime: latest?.closingTime.toISOString() ?? null }
  })
  // Save an end-of-day snapshot (Admin/Manager).
  app.post('/api/closings', { preHandler: requirePermission('closing') }, async (req) => {
    const { date } = (req.body ?? {}) as { date?: string }
    return await closing.saveDailyClosing(ctx(req), date)
  })
}
