// The VPS instance (docs/05-phase-4-vps-sync.md): same core service layer,
// pointed at the central datasource — but deliberately NOT buildApp() reused
// wholesale. It doesn't need Socket.IO/LAN discovery/local backup (those are
// on-site concerns), and it doesn't need the full staff-facing REST surface
// either — the only thing that talks to it is the local server's background
// sync job, authenticated with a service credential, not a staff session.
//
// Receiving side of sync is a single generic upsert endpoint keyed by entity
// name rather than one route per entity: the outbox already carries
// (entity, entityId, full-state payload), and every entity synced so far
// (Order, Transaction, InventoryItem) upserts the same way — add to
// ENTITY_MODELS below if a new entity starts getting synced, not a new route.

import Fastify, { type FastifyInstance } from 'fastify'
import { prisma } from '../db/client.js'
import { verifyServiceToken } from './serviceAuth.js'

export interface VpsAppOptions {
  // Present only when env.vps.tlsCertPath/tlsKeyPath are configured — see
  // src/vps/server.ts. Absent (plain HTTP) is what local dev and
  // scripts/verify-postgres.mjs use.
  https?: { cert: Buffer; key: Buffer }
}

type ModelDelegate = { upsert: (args: { where: { id: string }; create: unknown; update: unknown }) => Promise<unknown> }

const ENTITY_MODELS: Record<string, () => ModelDelegate> = {
  Order: () => prisma.order as unknown as ModelDelegate,
  Transaction: () => prisma.transaction as unknown as ModelDelegate,
  InventoryItem: () => prisma.inventoryItem as unknown as ModelDelegate,
  // Must land before any Order referencing it — Postgres enforces
  // Order_shiftId_fkey even though the local SQLite copy doesn't necessarily,
  // which is exactly the gap that surfaced this (see docs/05-phase-4-vps-sync.md
  // "Production hardening"). Enqueued at every lifecycle transition in
  // shifts.service.ts (start/pause/resume/end), always before any order that
  // can reference it, since a shift always starts before orders attributed to it.
  ShiftReconciliation: () => prisma.shiftReconciliation as unknown as ModelDelegate,
}

interface PushEntry {
  id: string // the outbox row's own id, echoed back so the caller knows which succeeded
  entity: string
  entityId: string
  payload: Record<string, unknown>
}

export function buildVpsApp(options: VpsAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: process.env.LOG_LEVEL ?? 'info' },
    https: options.https ?? null,
  })

  app.get('/api/health', async () => ({ ok: true }))

  app.post('/api/sync/push', async (req, reply) => {
    const auth = req.headers.authorization
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token || !(await verifyServiceToken(token))) {
      return reply.code(401).send({ error: 'Invalid or missing service credential.' })
    }

    const { entries } = (req.body ?? {}) as { entries?: PushEntry[] }
    if (!Array.isArray(entries)) return reply.code(400).send({ error: 'entries[] is required.' })

    const results: { id: string; ok: boolean; error?: string }[] = []
    for (const entry of entries) {
      const getModel = ENTITY_MODELS[entry.entity]
      if (!getModel) {
        results.push({ id: entry.id, ok: false, error: `Unknown entity: ${entry.entity}` })
        continue
      }
      try {
        // Dates arrive as ISO strings over JSON — Prisma needs real Date
        // objects for DateTime columns, so re-hydrate anything that looks
        // like one rather than maintaining a per-entity field list.
        const payload = Object.fromEntries(
          Object.entries(entry.payload).map(([k, v]) => [
            k,
            typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v) : v,
          ]),
        )
        await getModel().upsert({ where: { id: entry.entityId }, create: payload, update: payload })
        results.push({ id: entry.id, ok: true })
      } catch (err) {
        results.push({ id: entry.id, ok: false, error: (err as Error).message })
      }
    }
    return { results }
  })

  return app
}
