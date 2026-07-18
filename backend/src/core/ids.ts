// Server-side sequential ID generation — see schema.prisma's Sequence model
// and the orderNumber/txnNumber comment on Order/Transaction.
//
// The frontend currently mints "ORD-1046"/"TXN-500" style ids client-side via
// orderSeq/txnSeq counters held in AppContext.jsx React state. That breaks
// once multiple devices write concurrently against one server — this module
// replaces it with an atomic, server-side counter.
//
// Not DB-native autoincrement: SQLite only allows autoincrement on the
// primary key itself (hit this directly while writing schema.prisma), and
// the schema has to work unchanged on Postgres in Phase 4. An
// upsert-and-increment inside the caller's transaction is atomic under both
// engines' transaction isolation and needs no provider-specific SQL.

import type { Prisma, PrismaClient } from '@prisma/client'

type TxClient = Prisma.TransactionClient | PrismaClient

export type SequenceName = 'order' | 'transaction'

// Must be called with a transaction client when creating the record that
// will carry this number, so the increment and the insert commit together —
// otherwise a failed insert after a successful increment would burn a
// number (harmless — numbers don't need to be contiguous — but avoidable).
export async function nextSequence(tx: TxClient, name: SequenceName): Promise<number> {
  const seq = await tx.sequence.upsert({
    where: { name },
    create: { name, value: 1 },
    update: { value: { increment: 1 } },
  })
  return seq.value
}
