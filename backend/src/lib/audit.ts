// Central audit-log writer. Every mutating service call appends one row in the
// same shape AppContext.jsx already produces ({ id, action, ...details, by,
// role, at }) — see ../../CLAUDE.md "Audit trail convention". The heterogeneous
// per-action extra fields (orderId, amount, reason, ...) are stored as a JSON
// blob in `detailsJson` (schema.prisma AuditLogEntry), so the ~30 action types
// don't each need their own nullable columns.
//
// Takes a transaction client so the audit row commits atomically with the state
// change it records — a mutation and its audit entry are never split.

import type { Prisma, PrismaClient } from '@prisma/client'
import type { Actor } from './actor.js'

type TxClient = Prisma.TransactionClient | PrismaClient

export interface AuditInput {
  action: string
  actor: Actor
  // Optional FK to the acting staff member (nullable in schema — set when the
  // actor is a real seeded Staff row; a token minted for a not-yet-persisted
  // user would omit it).
  staffId?: string | null
  // Action-specific extra fields — serialised into detailsJson verbatim.
  details?: Record<string, unknown>
  at?: Date
}

export async function writeAudit(tx: TxClient, input: AuditInput): Promise<void> {
  await tx.auditLogEntry.create({
    data: {
      action: input.action,
      by: input.actor.name,
      role: input.actor.role,
      staffId: input.staffId ?? input.actor.id ?? null,
      detailsJson: JSON.stringify(input.details ?? {}),
      ...(input.at ? { at: input.at } : {}),
    },
  })
}
