import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticate, requirePermission, requireRole } from '../auth/guard.js'
import * as staff from '../services/staff.service.js'

export async function staffRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  // Staff list is read broadly (waiter selection on the POS), so just require auth.
  app.get('/api/staff', { preHandler: authenticate }, async () => ({ staff: await staff.listStaff() }))
  app.post('/api/staff', { preHandler: requirePermission('employees') }, async (req) => ({ staff: await staff.addStaff(ctx(req), req.body as staff.StaffInput) }))
  app.patch('/api/staff/:id', { preHandler: requirePermission('employees') }, async (req) => {
    const { id } = req.params as { id: string }
    return { staff: await staff.updateStaff(ctx(req), id, req.body as staff.StaffInput) }
  })
  // Delete Admin-only (stricter than employees, which Manager also holds).
  app.delete('/api/staff/:id', { preHandler: requireRole('Admin') }, async (req) => {
    const { id } = req.params as { id: string }
    return await staff.deleteStaff(ctx(req), id)
  })
  app.post('/api/staff/:id/toggle', { preHandler: requirePermission('employees') }, async (req) => {
    const { id } = req.params as { id: string }
    return { staff: await staff.toggleStaff(ctx(req), id) }
  })

  // Advances (payroll permission).
  app.get('/api/advances', { preHandler: requirePermission('payroll', 'access') }, async () => ({ advances: await staff.listAdvances() }))
  app.post('/api/advances', { preHandler: requirePermission('payroll') }, async (req) => ({ advance: await staff.addAdvance(ctx(req), req.body as never) }))
  app.delete('/api/advances/:id', { preHandler: requirePermission('payroll') }, async (req) => {
    const { id } = req.params as { id: string }
    return await staff.deleteAdvance(ctx(req), id)
  })
  app.post('/api/advances/recover', { preHandler: requirePermission('payroll') }, async (req) => {
    const { year, monthIndex } = (req.body ?? {}) as { year?: number; monthIndex?: number }
    return await staff.recoverAdvances(ctx(req), Number(year), Number(monthIndex))
  })
}
