// Background push job (docs/05-phase-4-vps-sync.md): checks VPS reachability
// on an interval, and when reachable, pushes due outbox rows in one batch.
// Never runs in the request path — day-to-day local operations (Phases 1-2)
// are provably unaffected by the VPS being unreachable, since this is purely
// a setInterval loop with its own try/catch, never awaited by any route
// handler.
//
// A no-op everywhere env.vps.url/syncSecret aren't configured — a plain
// local-only deployment (Phases 1-3) never needs the VPS to exist at all.

import { prisma } from '../db/client.js'
import { env } from '../env.js'
import { mintServiceToken } from '../vps/serviceAuth.js'

const BASE_BACKOFF_MS = 5_000
const MAX_BACKOFF_MS = 5 * 60_000
const BATCH_SIZE = 100

type OutboxRow = Awaited<ReturnType<typeof prisma.outboxEntry.findMany>>[number]

function backoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS)
}

// A never-yet-attempted row is always due; a previously-failed one waits out
// its exponential backoff window before being retried again.
function isDue(row: OutboxRow): boolean {
  if (!row.lastAttemptAt) return true
  return Date.now() - row.lastAttemptAt.getTime() >= backoffMs(row.attempts)
}

async function isVpsReachable(): Promise<boolean> {
  if (!env.vps.url) return false
  try {
    const res = await fetch(`${env.vps.url}/api/health`, { signal: AbortSignal.timeout(5_000) })
    return res.ok
  } catch {
    return false
  }
}

export interface SyncResult {
  pushed: number
  failed: number
}

export async function syncOnce(): Promise<SyncResult | null> {
  if (!env.vps.url || !env.vps.syncSecret) return null // sync not configured — see file header
  if (!(await isVpsReachable())) return null

  const candidates = await prisma.outboxEntry.findMany({
    where: { status: { in: ['pending', 'failed'] } },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE,
  })
  const due = candidates.filter(isDue)
  if (due.length === 0) return { pushed: 0, failed: 0 }

  let pushed = 0
  let failed = 0

  const markFailed = async (row: OutboxRow, message: string) => {
    await prisma.outboxEntry.update({
      where: { id: row.id },
      data: { status: 'failed', attempts: row.attempts + 1, lastError: message.slice(0, 500), lastAttemptAt: new Date() },
    })
    failed++
  }

  try {
    const token = mintServiceToken()
    const res = await fetch(`${env.vps.url}/api/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        entries: due.map((row) => ({ id: row.id, entity: row.entity, entityId: row.entityId, payload: JSON.parse(row.payloadJson) })),
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`VPS responded ${res.status}`)
    const data = (await res.json()) as { results: { id: string; ok: boolean; error?: string }[] }
    for (const result of data.results) {
      const row = due.find((d) => d.id === result.id)
      if (!row) continue
      if (result.ok) {
        await prisma.outboxEntry.update({ where: { id: row.id }, data: { status: 'synced', syncedAt: new Date() } })
        pushed++
      } else {
        await markFailed(row, result.error ?? 'Unknown error')
      }
    }
  } catch (err) {
    // The whole request failed (connectivity dropped mid-push, timeout, ...)
    // — every row in this batch stays retriable. Never delete/drop a row here.
    for (const row of due) await markFailed(row, (err as Error).message)
  }

  return { pushed, failed }
}

export function startSyncSchedule(): NodeJS.Timeout {
  syncOnce().catch(() => {})
  return setInterval(() => {
    syncOnce().catch(() => {})
  }, env.vps.syncIntervalMs)
}
