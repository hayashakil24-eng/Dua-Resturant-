import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticate, requirePermission, requireAnyPermission } from '../auth/guard.js'
import * as inventory from '../services/inventory.service.js'

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  app.get('/api/inventory', { preHandler: authenticate }, async () => ({ inventory: await inventory.listInventory() }))

  // Correct existing quantity (Admin/Manager) or add stock (Manager) — both UI
  // paths land here; accept either permission, same as the frontend's adjustStock.
  app.post('/api/inventory/:id/adjust', { preHandler: requireAnyPermission(['inventoryDirectEdit', 'inventoryAdd']) }, async (req) => {
    const { id } = req.params as { id: string }
    const { delta } = (req.body ?? {}) as { delta?: number }
    return { item: await inventory.adjustStock(ctx(req), id, Number(delta) || 0) }
  })

  app.post('/api/inventory/:id/restock', { preHandler: requireAnyPermission(['inventoryAdd', 'inventoryDirectEdit']) }, async (req) => {
    const { id } = req.params as { id: string }
    const { amount } = (req.body ?? {}) as { amount?: number }
    return { item: await inventory.restock(ctx(req), id, Number(amount) || 10) }
  })

  // Create a brand-new inventory item directly (Admin, per inventoryCreate).
  app.post('/api/inventory', { preHandler: requirePermission('inventoryCreate') }, async (req) => {
    return { item: await inventory.addInventoryItem(ctx(req), req.body as inventory.AddInventoryInput) }
  })
}
