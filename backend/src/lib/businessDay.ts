import { prisma } from '../db/client.js'

// The business-day "session" boundary: the moment the day was last closed.
// Everything after it belongs to the open session; null before the first ever
// closing. A single timestamp (not per-date) so a forgotten-then-caught-up
// close spanning two calendar days still reports one continuous session.
//
// Lives here rather than in closing.service so shifts.service can scope cash
// positions to the same session without importing closing.service, which
// already imports shifts.service (getActiveShift) — that would be a cycle.
export async function getBoundaryIso(): Promise<string | null> {
  const last = await prisma.dailyClosing.findFirst({ orderBy: { closingTime: 'desc' } })
  return last ? last.closingTime.toISOString() : null
}
