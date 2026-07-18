import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticate, requirePermission } from '../auth/guard.js'
import * as menu from '../services/menu.service.js'

export async function menuRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  // Menu items (reads are open to any authenticated device — the POS needs them).
  app.get('/api/menu', { preHandler: authenticate }, async () => ({ menu: await menu.listMenu() }))
  app.post('/api/menu', { preHandler: requirePermission('menu') }, async (req) => ({ item: await menu.addMenuItem(ctx(req), req.body as menu.MenuItemInput) }))
  app.put('/api/menu', { preHandler: requirePermission('menu') }, async (req) => {
    const { items } = (req.body ?? {}) as { items?: menu.MenuItemInput[] }
    return { menu: await menu.replaceMenu(ctx(req), items ?? []) }
  })
  app.patch('/api/menu/:id', { preHandler: requirePermission('menu') }, async (req) => {
    const { id } = req.params as { id: string }
    return { item: await menu.updateMenuItem(ctx(req), id, req.body as menu.MenuItemInput) }
  })
  app.delete('/api/menu/:id', { preHandler: requirePermission('menu') }, async (req) => {
    const { id } = req.params as { id: string }
    return await menu.deleteMenuItem(ctx(req), id)
  })
  app.post('/api/menu/:id/toggle', { preHandler: requirePermission('menu') }, async (req) => {
    const { id } = req.params as { id: string }
    return { item: await menu.toggleMenuItem(ctx(req), id) }
  })

  // Categories
  app.get('/api/categories', { preHandler: authenticate }, async () => ({ categories: await menu.listCategories() }))
  app.post('/api/categories', { preHandler: requirePermission('categoryAdd') }, async (req) => {
    const { name } = (req.body ?? {}) as { name?: string }
    return await menu.addCategory(ctx(req), String(name ?? ''))
  })
  app.delete('/api/categories/:name', { preHandler: requirePermission('categoryAdd') }, async (req) => {
    const { name } = req.params as { name: string }
    return await menu.deleteCategory(ctx(req), decodeURIComponent(name))
  })

  // Shared "Most Ordered" list (any POS role, per mostOrderedManage).
  app.get('/api/most-ordered', { preHandler: authenticate }, async () => ({ mostOrdered: await menu.listMostOrdered() }))
  app.post('/api/most-ordered/:menuItemId/toggle', { preHandler: requirePermission('mostOrderedManage') }, async (req) => {
    const { menuItemId } = req.params as { menuItemId: string }
    return await menu.toggleMostOrdered(ctx(req), menuItemId)
  })
}
