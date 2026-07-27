// Operational visibility (docs/04-phase-3-deployment-hardening.md §"Basic
// operational visibility") — surfaced in Settings.jsx per that doc's frontend
// note. Gated the same as /api/settings (Admin-only): this is server
// health/ops info, not a feature any role needs day-to-day.
import type { FastifyInstance } from 'fastify'
import { requirePermission } from '../auth/guard.js'
import { lastBackupInfo, runBackup } from '../backup/backup.js'
import { prisma } from '../db/client.js'
import { env } from '../env.js'
import { syncOnce } from '../sync/job.js'

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

  // Manual "Sync Now" (Settings page, docs/05-phase-4-vps-sync.md) — the
  // background job (startSyncSchedule) already retries on its own interval,
  // so this is a convenience for an Admin who doesn't want to wait for the
  // next tick after fixing a connectivity issue. Same syncOnce() the
  // scheduled job calls — no separate code path to keep in sync with it.
  app.post('/api/system/sync-now', { preHandler: requirePermission('settings', 'access') }, async (_req, reply) => {
    if (!env.vps.url || !env.vps.syncSecret) {
      return reply.code(400).send({ error: 'VPS sync is not configured on this server.' })
    }
    const result = await syncOnce()
    if (result === null) {
      return reply.code(502).send({ error: 'Could not reach the VPS. Check its address and your internet connection.' })
    }
    return result
  })

  // Manual backup — the scheduled job (startBackupSchedule) already writes
  // one once a day at env.backupHour, so this is for an Admin who wants a
  // fresh copy right now (e.g. right before a risky change) rather than
  // waiting for the next scheduled run. Same runBackup() the scheduled job
  // calls, so "once a day" and "on demand" can never disagree about how a
  // backup is actually taken.
  app.post('/api/system/backup-now', { preHandler: requirePermission('settings', 'access') }, async (_req, reply) => {
    try {
      const result = runBackup()
      return { path: result.path, at: result.at.toISOString() }
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message })
    }
  })
}
