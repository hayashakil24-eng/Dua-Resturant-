import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticate, requirePermission } from '../auth/guard.js'
import * as settings from '../services/settings.service.js'

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  // GST settings are read by the POS to display the rate; keep the read open.
  app.get('/api/settings', { preHandler: authenticate }, async () => ({ settings: await settings.getSettings() }))
  app.post('/api/settings/gst', { preHandler: requirePermission('settings') }, async (req) => {
    const { enabled } = (req.body ?? {}) as { enabled?: boolean }
    return { settings: await settings.setGst(ctx(req), Boolean(enabled)) }
  })
  app.post('/api/settings/gst-rate', { preHandler: requirePermission('settings') }, async (req) => {
    const { pct } = (req.body ?? {}) as { pct?: number }
    return { settings: await settings.setGstRate(ctx(req), Number(pct)) }
  })

  // Online payment accounts
  app.get('/api/online-accounts', { preHandler: authenticate }, async () => ({ accounts: await settings.listOnlineAccounts() }))
  app.post('/api/online-accounts', { preHandler: requirePermission('settings') }, async (req) => ({ account: await settings.addOnlineAccount(ctx(req), req.body as never) }))
  app.patch('/api/online-accounts/:id', { preHandler: requirePermission('settings') }, async (req) => {
    const { id } = req.params as { id: string }
    return { account: await settings.updateOnlineAccount(ctx(req), id, req.body as never) }
  })
  app.post('/api/online-accounts/:id/toggle', { preHandler: requirePermission('settings') }, async (req) => {
    const { id } = req.params as { id: string }
    return { account: await settings.toggleOnlineAccount(ctx(req), id) }
  })
}
