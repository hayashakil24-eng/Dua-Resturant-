import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticate, requirePermission } from '../auth/guard.js'
import * as departments from '../services/departments.service.js'

export async function departmentRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  // Reads open to any authenticated device (KDS/POS resolve routing).
  app.get('/api/departments', { preHandler: authenticate }, async () => ({ departments: await departments.listDepartments() }))
  app.post('/api/departments', { preHandler: requirePermission('departments') }, async (req) => ({ department: await departments.addDepartment(ctx(req), req.body as never) }))
  app.delete('/api/departments/:id', { preHandler: requirePermission('departments') }, async (req) => {
    const { id } = req.params as { id: string }
    return await departments.deleteDepartment(ctx(req), id)
  })
  // Assign moves the item to this department; remove clears it.
  app.post('/api/departments/:id/items', { preHandler: requirePermission('departments') }, async (req) => {
    const { id } = req.params as { id: string }
    const { itemId } = (req.body ?? {}) as { itemId?: string }
    return await departments.assignItemToDepartment(ctx(req), String(itemId), id)
  })
  app.delete('/api/departments/:id/items/:itemId', { preHandler: requirePermission('departments') }, async (req) => {
    const { id, itemId } = req.params as { id: string; itemId: string }
    return await departments.removeItemFromDepartment(ctx(req), itemId, id)
  })
}
