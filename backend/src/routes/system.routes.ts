// Operational visibility (docs/04-phase-3-deployment-hardening.md §"Basic
// operational visibility") — surfaced in Settings.jsx per that doc's frontend
// note. Gated the same as /api/settings (Admin-only): this is server
// health/ops info, not a feature any role needs day-to-day.
import type { FastifyInstance } from 'fastify'
import { requirePermission } from '../auth/guard.js'
import { lastBackupInfo } from '../backup/backup.js'

const startedAt = Date.now()

export async function systemRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/system/health', { preHandler: requirePermission('settings', 'access') }, async () => {
    const backup = lastBackupInfo()
    return {
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      lastBackupAt: backup?.at ?? null,
    }
  })
}
