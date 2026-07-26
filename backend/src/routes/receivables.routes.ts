import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticate, requirePermission } from '../auth/guard.js'
import * as receivables from '../services/receivables.service.js'

export async function receivableRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  app.get('/api/receivables', { preHandler: authenticate }, async () => ({ receivables: await receivables.listReceivables() }))

  // No POST /api/receivables — an account is never created directly. It only
  // comes into existence via POST /api/orders/:id/udhaar (orders.service's
  // markOrderUdhaar), so every account is backed by a real unpaid order.

  app.post('/api/receivables/:id/payment', { preHandler: requirePermission('receivables') }, async (req) => {
    const { id } = req.params as { id: string }
    const { amount, method, notes } = (req.body ?? {}) as { amount?: number | null; method?: string; notes?: string }
    return await receivables.recordReceivablePayment(ctx(req), id, amount, { method, notes })
  })
}
