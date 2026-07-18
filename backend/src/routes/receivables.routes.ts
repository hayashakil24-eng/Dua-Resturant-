import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticate, requirePermission } from '../auth/guard.js'
import * as receivables from '../services/receivables.service.js'

export async function receivableRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  app.get('/api/receivables', { preHandler: authenticate }, async () => ({ receivables: await receivables.listReceivables() }))

  app.post('/api/receivables', { preHandler: requirePermission('receivables') }, async (req) => {
    const { name, amount, type, notes } = (req.body ?? {}) as { name?: string; amount?: number; type?: string; notes?: string }
    return { receivable: await receivables.addReceivable(ctx(req), { name, amount, type, notes }) }
  })

  app.post('/api/receivables/:id/payment', { preHandler: requirePermission('receivables') }, async (req) => {
    const { id } = req.params as { id: string }
    const { amount, method, notes } = (req.body ?? {}) as { amount?: number | null; method?: string; notes?: string }
    return await receivables.recordReceivablePayment(ctx(req), id, amount, { method, notes })
  })
}
