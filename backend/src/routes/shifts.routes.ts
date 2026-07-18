import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticate, requirePermission, requireAnyPermission } from '../auth/guard.js'
import * as shifts from '../services/shifts.service.js'

export async function shiftRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })
  // Running a drawer is a POS/cashier action (Cashier/Admin have pos; Manager
  // does not cashier). Handover approval is the separate 'handovers' permission.
  const drawer = requireAnyPermission(['pos', 'billing'])

  // Reads
  app.get('/api/shifts', { preHandler: authenticate }, async () => ({ shifts: await shifts.listShifts() }))
  app.get('/api/shifts/active', { preHandler: authenticate }, async () => ({ shift: await shifts.getActiveShift() }))
  app.get('/api/shifts/:id/sales', { preHandler: authenticate }, async (req) => {
    const { id } = req.params as { id: string }
    return { sales: await shifts.calculateShiftSales(id) }
  })
  app.get('/api/handovers', { preHandler: authenticate }, async () => ({ handovers: await shifts.listPendingHandovers() }))

  // Shift lifecycle
  app.post('/api/shifts/start', { preHandler: drawer }, async (req) => {
    const { openingCash } = (req.body ?? {}) as { openingCash?: number }
    return { shift: await shifts.startShift(ctx(req), Number(openingCash) || 0) }
  })
  app.post('/api/shifts/pause', { preHandler: drawer }, async (req) => ({ shift: await shifts.pauseShift(ctx(req)) }))
  app.post('/api/shifts/resume', { preHandler: drawer }, async (req) => ({ shift: await shifts.resumeShift(ctx(req)) }))
  app.post('/api/shifts/:id/end', { preHandler: drawer }, async (req) => {
    const { id } = req.params as { id: string }
    const { actualCash, handover } = (req.body ?? {}) as { actualCash?: number; handover?: { to?: string; name?: string; reason?: string } }
    return { shift: await shifts.endShift(ctx(req), id, Number(actualCash) || 0, handover ?? {}) }
  })

  // Handovers — cashier initiates, Manager/Admin accept/reject (per 'handovers').
  app.post('/api/handovers', { preHandler: drawer }, async (req) => {
    const { amount, toName, toRole, reason } = (req.body ?? {}) as { amount?: number; toName?: string; toRole?: string; reason?: string }
    return { handover: await shifts.initiateHandover(ctx(req), { amount, toName, toRole, reason }) }
  })
  app.post('/api/handovers/:id/accept', { preHandler: requirePermission('handovers') }, async (req) => {
    const { id } = req.params as { id: string }
    return { handover: await shifts.acceptHandover(ctx(req), id) }
  })
  app.post('/api/handovers/:id/reject', { preHandler: requirePermission('handovers') }, async (req) => {
    const { id } = req.params as { id: string }
    const { reason } = (req.body ?? {}) as { reason?: string }
    return { handover: await shifts.rejectHandover(ctx(req), id, reason ?? '') }
  })
}
