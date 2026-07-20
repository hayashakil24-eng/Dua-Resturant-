import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticate, requirePermission, requireAnyPermission } from '../auth/guard.js'
import * as orders from '../services/orders.service.js'

// Thin REST adapter over orders.service. Each mutating route carries the same
// permission the frontend UI gate used (docs/02-phase-1), enforced server-side
// via the guard preHandlers. Handlers just unpack the request and delegate;
// all business logic + audit lives in the service.

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  // Reads — any authenticated device (POS, Tables, KDS all consume orders).
  app.get('/api/orders', { preHandler: authenticate }, async () => ({ orders: await orders.listOrders() }))
  app.get('/api/orders/:id', { preHandler: authenticate }, async (req) => {
    const { id } = req.params as { id: string }
    return { order: await orders.getOrder(id) }
  })

  // Place an order — POS or Billing.
  app.post('/api/orders', { preHandler: requireAnyPermission(['pos', 'billing']) }, async (req) => {
    return { order: await orders.addOrder(ctx(req), req.body as orders.AddOrderInput) }
  })

  // Append to a running (unpaid) bill.
  app.post('/api/orders/:id/items', { preHandler: requireAnyPermission(['pos', 'orders', 'billing']) }, async (req) => {
    const { id } = req.params as { id: string }
    const { items } = (req.body ?? {}) as { items?: orders.OrderItemInput[] }
    return { order: await orders.appendOrderItems(ctx(req), id, items ?? []) }
  })

  // Edit a line quantity (itemKey = cart key or DB row id).
  app.patch('/api/orders/:id/items', { preHandler: requireAnyPermission(['pos', 'orders', 'billing']) }, async (req) => {
    const { id } = req.params as { id: string }
    const { itemKey, qty } = (req.body ?? {}) as { itemKey?: string; qty?: number }
    return { order: await orders.updateOrderItemQty(ctx(req), id, String(itemKey), qty ?? 0) }
  })

  // Move a running order to another table (re-seat) — same gate as editing a
  // running order's lines, since it's the same class of running-order change.
  app.post('/api/orders/:id/table', { preHandler: requireAnyPermission(['pos', 'orders', 'billing']) }, async (req) => {
    const { id } = req.params as { id: string }
    const { table } = (req.body ?? {}) as { table?: number | string }
    return { order: await orders.shiftOrderTable(ctx(req), id, table as number | string) }
  })

  // Take payment.
  app.post('/api/orders/:id/pay', { preHandler: requireAnyPermission(['orders', 'billing']) }, async (req) => {
    const { id } = req.params as { id: string }
    const { method, onlineAccountId } = (req.body ?? {}) as { method?: string; onlineAccountId?: string | null }
    return { order: await orders.markPaid(ctx(req), id, method ?? 'Cash', onlineAccountId ?? null) }
  })

  // Cancel (Admin only, per orderCancel).
  app.post('/api/orders/:id/cancel', { preHandler: requirePermission('orderCancel') }, async (req) => {
    const { id } = req.params as { id: string }
    const { reason, notes } = (req.body ?? {}) as { reason?: string; notes?: string }
    return { order: await orders.cancelOrder(ctx(req), id, { reason, notes }) }
  })

  // Discount (Admin/Manager, per discount).
  app.post('/api/orders/:id/discount', { preHandler: requirePermission('discount') }, async (req) => {
    const { id } = req.params as { id: string }
    const { amount, reason, notes } = (req.body ?? {}) as { amount?: number; reason?: string; notes?: string }
    return { order: await orders.applyDiscount(ctx(req), id, { amount, reason, notes }) }
  })
  app.delete('/api/orders/:id/discount', { preHandler: requirePermission('discount') }, async (req) => {
    const { id } = req.params as { id: string }
    return { order: await orders.removeDiscount(ctx(req), id) }
  })

  // On-account (udhaar) — Manager/Admin, per receivables.
  app.post('/api/orders/:id/udhaar', { preHandler: requirePermission('receivables') }, async (req) => {
    const { id } = req.params as { id: string }
    const { accountId, customerName } = (req.body ?? {}) as { accountId?: string; customerName?: string }
    return await orders.markOrderUdhaar(ctx(req), id, { accountId, customerName })
  })

  // Complimentary — Manager/Admin, per orderComplimentary.
  app.post('/api/orders/:id/complimentary', { preHandler: requirePermission('orderComplimentary') }, async (req) => {
    const { id } = req.params as { id: string }
    const { orderedBy, reason, notes } = (req.body ?? {}) as { orderedBy?: string; reason?: string; notes?: string }
    return { order: await orders.markOrderComplimentary(ctx(req), id, { orderedBy, reason, notes }) }
  })

  // Kitchen display transitions.
  app.post('/api/orders/:id/ready', { preHandler: requirePermission('kds') }, async (req) => {
    const { id } = req.params as { id: string }
    return { order: await orders.markReady(ctx(req), id) }
  })
  app.post('/api/orders/:id/served', { preHandler: requirePermission('kds') }, async (req) => {
    const { id } = req.params as { id: string }
    return { order: await orders.clearKitchen(ctx(req), id) }
  })
}
