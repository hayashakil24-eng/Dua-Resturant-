import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticate, requirePermission } from '../auth/guard.js'
import * as settings from '../services/settings.service.js'
import * as whatsappRecipients from '../services/whatsappRecipients.service.js'

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
  app.post('/api/settings/whatsapp-report', { preHandler: requirePermission('settings') }, async (req) => {
    return { settings: await settings.setWhatsappReportConfig(ctx(req), req.body as never) }
  })
  app.post('/api/settings/attendance-device', { preHandler: requirePermission('settings') }, async (req) => {
    return { settings: await settings.setAttendanceDeviceConfig(ctx(req), req.body as never) }
  })

  // WhatsApp test-mode recipient allowlist (see WhatsappRecipient's own
  // schema.prisma comment for why this exists — Meta's API can't list its
  // own allowlist back, so "add" here actually attempts a real send to find out).
  app.get('/api/whatsapp/recipients', { preHandler: authenticate }, async () => ({
    recipients: await whatsappRecipients.listWhatsappRecipients(),
  }))
  app.post('/api/whatsapp/recipients', { preHandler: requirePermission('settings') }, async (req) => ({
    recipient: await whatsappRecipients.addWhatsappRecipient(ctx(req), req.body as never),
  }))
  app.post('/api/whatsapp/recipients/:id/recheck', { preHandler: requirePermission('settings') }, async (req) => {
    const { id } = req.params as { id: string }
    return { recipient: await whatsappRecipients.recheckWhatsappRecipient(ctx(req), id) }
  })
  app.delete('/api/whatsapp/recipients/:id', { preHandler: requirePermission('settings') }, async (req) => {
    const { id } = req.params as { id: string }
    return whatsappRecipients.removeWhatsappRecipient(ctx(req), id)
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
