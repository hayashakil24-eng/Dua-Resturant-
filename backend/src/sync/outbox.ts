// Enqueues one Phase 4 sync row (docs/05-phase-4-vps-sync.md) inside
// the same Prisma transaction as the state change it's reporting on, so the
// outbox row and the mutation commit atomically — same pattern as writeAudit
// in lib/audit.ts, and for the same reason (a mutation and the record of it
// must never be split).
//
// Called explicitly at a focused set of call sites (new order, payment,
// cancellation, stock adjustment, transactions) matching the docs' own
// example list — not instrumented at every single mutation the way
// writeAudit is, since outbox entries need the full current-state snapshot
// of a specific entity type, not a generic action/details blob.

import type { Prisma, PrismaClient } from '@prisma/client'

type TxClient = Prisma.TransactionClient | PrismaClient

export async function enqueueOutbox(tx: TxClient, entity: string, entityId: string, payload: unknown): Promise<void> {
  await tx.outboxEntry.create({
    data: { entity, entityId, payloadJson: JSON.stringify(payload) },
  })
}
