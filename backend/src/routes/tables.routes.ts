import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticate, requirePermission, requireRole } from '../auth/guard.js'
import * as tables from '../services/tables.service.js'

export async function tableRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  app.get('/api/tables', { preHandler: authenticate }, async () => ({ tables: await tables.listTables() }))
  app.post('/api/tables', { preHandler: requirePermission('tableAdd') }, async (req) => ({ table: await tables.addTable(ctx(req), req.body as never) }))
  app.patch('/api/tables/:id', { preHandler: requirePermission('tableAdd') }, async (req) => {
    const { id } = req.params as { id: string }
    return { table: await tables.updateTable(ctx(req), Number(id), req.body as never) }
  })
  // Delete is Admin-only (stricter than tableAdd, which Manager also holds).
  app.delete('/api/tables/:id', { preHandler: requireRole('Admin') }, async (req) => {
    const { id } = req.params as { id: string }
    return await tables.deleteTable(ctx(req), Number(id))
  })
}
