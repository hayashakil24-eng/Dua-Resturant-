import type { Prisma } from '@prisma/client'
import { prisma } from '../db/client.js'

// The business-day "session" boundary: the moment the day was last closed.
// Everything after it belongs to the open session; null before the first ever
// closing. A single timestamp (not per-date) so a forgotten-then-caught-up
// close spanning two calendar days still reports one continuous session.
//
// Lives here rather than in closing.service so shifts.service can scope cash
// positions to the same session without importing closing.service, which
// already imports shifts.service (getActiveShift) — that would be a cycle.
// Accepts a transaction client so callers already inside a $transaction read
// the boundary on that same connection instead of queueing behind it.
export async function getBoundaryIso(client: Prisma.TransactionClient = prisma): Promise<string | null> {
  const last = await client.dailyClosing.findFirst({ orderBy: { closingTime: 'desc' } })
  return last ? last.closingTime.toISOString() : null
}

// Prisma `where` fragment limiting orders to the open session. A table lock or
// pending check must use the same boundary the live screens do — otherwise an
// Unpaid order from before the last closing keeps a table "occupied" forever
// even though no screen shows it.
export function sessionCreatedAtFilter(boundaryIso: string | null): { createdAt?: { gt: Date } } {
  return boundaryIso ? { createdAt: { gt: new Date(boundaryIso) } } : {}
}
