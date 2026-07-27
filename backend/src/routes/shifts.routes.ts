import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticate, requirePermission } from '../auth/guard.js'
import * as shifts from '../services/shifts.service.js'

export async function shiftRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })
  // Running a cash drawer is its own permission, NOT implied by 'pos'/'billing'.
  // A Manager can punch and settle orders but must never run a drawer: they are
  // the ones who RECEIVE handovers, and someone who both hands cash over and
  // signs for it defeats the whole chain. Handover approval is the separate
  // 'handovers' permission; forwarding is 'handoverForward'.
  const drawer = requirePermission('drawer')

  // Reads
  app.get('/api/shifts', { preHandler: authenticate }, async () => ({ shifts: await shifts.listShifts() }))
  app.get('/api/shifts/active', { preHandler: authenticate }, async () => ({ shift: await shifts.getActiveShift() }))
  app.get('/api/shifts/:id/sales', { preHandler: authenticate }, async (req) => {
    const { id } = req.params as { id: string }
    return { sales: await shifts.calculateShiftSales(id) }
  })
  // Scoped to the caller — see listPendingHandovers. A Manager must not be able
  // to read the Admin's cash position, so the filtering happens here rather than
  // being left to the UI.
  app.get('/api/handovers', { preHandler: authenticate }, async (req) => ({
    handovers: await shifts.listPendingHandovers(req.actor),
  }))

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
  // Manager → Admin: forwarding cash already collected, so the whole chain
  // ends in one pair of hands. Not 'handovers' — that permission is for
  // approving, and Admin holds it but must never forward (nowhere above).
  app.post('/api/handovers/forward', { preHandler: requirePermission('handoverForward') }, async (req) => {
    const { amount, reason } = (req.body ?? {}) as { amount?: number; reason?: string }
    return { handover: await shifts.forwardHandover(ctx(req), { amount, reason }) }
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
