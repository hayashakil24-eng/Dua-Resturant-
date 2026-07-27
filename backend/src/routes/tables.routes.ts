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

  // A whole hall in one call — see bulkAddTables for why this isn't a client
  // loop over POST /api/tables. Same gate: adding 40 tables is not a bigger
  // power than adding one.
  app.post('/api/tables/bulk', { preHandler: requirePermission('tableAdd') }, async (req) =>
    await tables.bulkAddTables(ctx(req), req.body as never))

  // Category-level ops: update covers the hall edit form (rename/merge, seats,
  // section, grow, relabel); rename stays for older callers; delete removes them.
  app.post('/api/tables/category/update', { preHandler: requirePermission('tableAdd') }, async (req) =>
    await tables.updateTableCategory(ctx(req), req.body as never))
  app.post('/api/tables/category/rename', { preHandler: requirePermission('tableAdd') }, async (req) => {
    const { from, name } = (req.body ?? {}) as { from?: string; name?: string }
    return await tables.renameTableCategory(ctx(req), String(from ?? ''), String(name ?? ''))
  })
  app.post('/api/tables/category/delete', { preHandler: requireRole('Admin') }, async (req) => {
    const { category } = (req.body ?? {}) as { category?: string }
    return await tables.deleteTableCategory(ctx(req), String(category ?? ''))
  })
}
