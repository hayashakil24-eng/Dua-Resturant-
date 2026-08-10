import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticate, requirePermission, requireRole } from '../auth/guard.js'
import * as staff from '../services/staff.service.js'
import { listLoginAccounts, setStaffPassword } from '../services/auth.service.js'
import { ServiceError } from '../lib/errors.js'

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

  // Login accounts + Admin password reset. Admin-only: resetting a password is
  // a takeover of that account, so it stays with the role that already holds
  // staff approval and deletion, not with `employees` (which Manager holds).
  app.get('/api/staff/login-accounts', { preHandler: requireRole('Admin') }, async () => ({
    accounts: await listLoginAccounts(),
  }))
  app.post('/api/staff/:id/password', { preHandler: requireRole('Admin') }, async (req) => {
    const { id } = req.params as { id: string }
    const { newPassword, username, systemRole } = (req.body ?? {}) as {
      newPassword?: unknown
      username?: unknown
      systemRole?: unknown
    }
    return await setStaffPassword(req.actor, id, newPassword, { username, systemRole })
  })

  // Self-signup approval queue — Admin-only (staffApproval), same
  // separation-of-duties pattern as recipes.routes.ts's approve/reject.
  app.get('/api/staff/pending-signups', { preHandler: requirePermission('staffApproval', 'access') }, async () => ({
    pendingSignups: await staff.listPendingSignups(),
  }))
  app.post('/api/staff/:id/approve-signup', { preHandler: requirePermission('staffApproval') }, async (req) => {
    const { id } = req.params as { id: string }
    const { systemRole } = (req.body ?? {}) as { systemRole?: unknown }
    return { staff: await staff.approveSignup(ctx(req), id, systemRole) }
  })
  app.post('/api/staff/:id/reject-signup', { preHandler: requirePermission('staffApproval') }, async (req) => {
    const { id } = req.params as { id: string }
    const { reason } = (req.body ?? {}) as { reason?: string }
    return { staff: await staff.rejectSignup(ctx(req), id, reason) }
  })

  // Advances (payroll permission).
  app.get('/api/advances', { preHandler: requirePermission('payroll', 'access') }, async () => ({ advances: await staff.listAdvances() }))
  app.post('/api/advances', { preHandler: requirePermission('payroll') }, async (req) => ({ advance: await staff.addAdvance(ctx(req), req.body as never) }))
  app.delete('/api/advances/:id', { preHandler: requirePermission('payroll') }, async (req) => {
    const { id } = req.params as { id: string }
    return await staff.deleteAdvance(ctx(req), id)
  })
  app.post('/api/advances/recover', { preHandler: requirePermission('payroll') }, async (req) => {
    const { year, monthIndex, staffId } = (req.body ?? {}) as { year?: number; monthIndex?: number; staffId?: string }
    return await staff.recoverAdvances(ctx(req), Number(year), Number(monthIndex), staffId || undefined)
  })

  // Salary payments (payroll permission) — per-employee "salary paid" record,
  // distinct from advances above.
  app.get('/api/payroll/paid', { preHandler: requirePermission('payroll', 'access') }, async (req) => {
    const { year, month } = req.query as { year?: string; month?: string }
    const y = Number(year)
    const m = Number(month)
    if (!Number.isFinite(y) || !Number.isFinite(m)) throw new ServiceError('A valid year and month are required.')
    return { paid: await staff.listSalaryPayments(y, m) }
  })
  app.post('/api/payroll/:staffId/pay', { preHandler: requirePermission('payroll') }, async (req) => {
    const { staffId } = req.params as { staffId: string }
    const { year, month, amount, paidAt } = (req.body ?? {}) as { year?: number; month?: number; amount?: number; paidAt?: string }
    return { payment: await staff.markSalaryPaid(ctx(req), staffId, { year: Number(year), month: Number(month), amount: Number(amount), paidAt }) }
  })
  app.post('/api/payroll/:staffId/unpay', { preHandler: requirePermission('payroll') }, async (req) => {
    const { staffId } = req.params as { staffId: string }
    const { year, month } = (req.body ?? {}) as { year?: number; month?: number }
    return await staff.unmarkSalaryPaid(ctx(req), staffId, Number(year), Number(month))
  })
}
