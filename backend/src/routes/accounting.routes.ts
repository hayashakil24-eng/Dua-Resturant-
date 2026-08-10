import type { FastifyInstance, FastifyRequest } from 'fastify'
import { requirePermission, requireAnyPermission } from '../auth/guard.js'
import * as accounting from '../services/accounting.service.js'

export async function accountingRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  app.get('/api/transactions', { preHandler: requirePermission('accounting', 'access') }, async () => ({ transactions: await accounting.listTransactions() }))
  // Cashier reaches this via 'expenseEntry' (create-only quick-add), never the
  // full ledger — addTransaction itself re-checks the actor's actual grant so
  // an expenseEntry-only caller can't smuggle in type:'income' or a delete.
  app.post('/api/transactions', { preHandler: requireAnyPermission(['accounting', 'expenseEntry']) }, async (req) => ({
    transaction: await accounting.addTransaction(ctx(req), req.body as never),
  }))
  app.delete('/api/transactions/:id', { preHandler: requirePermission('accounting') }, async (req) => {
    const { id } = req.params as { id: string }
    return await accounting.deleteTransaction(ctx(req), id)
  })
}
