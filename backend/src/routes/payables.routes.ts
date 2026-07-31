import type { FastifyInstance, FastifyRequest } from 'fastify'
import { requirePermission } from '../auth/guard.js'
import * as payables from '../services/payables.service.js'

export async function payableRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  // Read gate matches purchase history (accounting/access) — supplier debt is
  // spend data, not everyday operational data any role needs to see.
  app.get('/api/payables', { preHandler: requirePermission('accounting', 'access') }, async () => ({
    payables: await payables.listPayables(),
  }))

  // No POST /api/payables — an account is never created directly. It only
  // comes into existence via POST /api/inventory/:id/purchase with paid:false
  // (inventory.service's recordPurchase), so every account is backed by a
  // real credit purchase.

  app.post('/api/payables/:id/payment', { preHandler: requirePermission('inventoryAdd') }, async (req) => {
    const { id } = req.params as { id: string }
    const { amount, method, notes } = (req.body ?? {}) as { amount?: number | null; method?: string; notes?: string }
    return await payables.recordPayablePayment(ctx(req), id, amount, { method, notes })
  })
}
