import type { FastifyInstance, FastifyRequest } from 'fastify'
import { requirePermission } from '../auth/guard.js'
import * as accounting from '../services/accounting.service.js'

export async function accountingRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  app.get('/api/transactions', { preHandler: requirePermission('accounting', 'access') }, async () => ({ transactions: await accounting.listTransactions() }))
  app.post('/api/transactions', { preHandler: requirePermission('accounting') }, async (req) => ({ transaction: await accounting.addTransaction(ctx(req), req.body as never) }))
  app.delete('/api/transactions/:id', { preHandler: requirePermission('accounting') }, async (req) => {
    const { id } = req.params as { id: string }
    return await accounting.deleteTransaction(ctx(req), id)
  })
}
