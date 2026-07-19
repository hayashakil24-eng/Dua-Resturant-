// Operational visibility (docs/04-phase-3-deployment-hardening.md §"Basic
// operational visibility") — surfaced in Settings.jsx per that doc's frontend
// note. Gated the same as /api/settings (Admin-only): this is server
// health/ops info, not a feature any role needs day-to-day.
import type { FastifyInstance } from 'fastify'
import { requirePermission } from '../auth/guard.js'
import { lastBackupInfo } from '../backup/backup.js'
import { prisma } from '../db/client.js'
import { env } from '../env.js'

const startedAt = Date.now()

export async function systemRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/system/health', { preHandler: requirePermission('settings', 'access') }, async () => {
    const backup = lastBackupInfo()
    // Phase 4 (docs/05-phase-4-vps-sync.md "Frontend alignment"): Settings'
    // health card gets a last-successful-sync field once VPS sync exists.
    // vpsConfigured lets the UI distinguish "not set up" from "set up but
    // hasn't synced yet" rather than showing a bare null either way.
    const lastSync = env.vps.url
      ? await prisma.outboxEntry.findFirst({ where: { status: 'synced' }, orderBy: { syncedAt: 'desc' } })
      : null
    const pendingSyncCount = env.vps.url ? await prisma.outboxEntry.count({ where: { status: { in: ['pending', 'failed'] } } }) : 0
    return {
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      lastBackupAt: backup?.at ?? null,
      vpsConfigured: Boolean(env.vps.url),
      lastSyncAt: lastSync?.syncedAt?.toISOString() ?? null,
      pendingSyncCount,
    }
  })
}
