import type { FastifyInstance } from 'fastify'
import { authenticate } from '../auth/guard.js'
import * as audit from '../services/audit.service.js'

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/audit', { preHandler: authenticate }, async (req) => {
    const { limit } = req.query as { limit?: string }
    return { audit: await audit.listAudit(limit ? Number(limit) : 200) }
  })
}
