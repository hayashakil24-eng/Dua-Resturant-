// Broadcasts one state-changing action to every connected LAN device. Called
// from two places:
//   1. writeAudit() — the audit log is already the canonical list of "things
//      worth telling other devices about" for most mutations, so that's the
//      one place that needs to know about Socket.IO rather than every
//      service function individually.
//   2. A handful of hot-path mutations that intentionally skip the audit log
//      for performance/noise reasons but still must broadcast — addOrder,
//      markPaid, markReady, clearKitchen, updateTable, startShift/pauseShift/
//      resumeShift. Without this, a drinks-only order (no recipe, so no
//      inventory-deduction audit row either) would never appear on another
//      device's KDS/Tables screen — exactly the Phase 2 acceptance case.
//
// Never throws: a broadcast failure (e.g. no socket server in tests) must
// never break the mutation it's reporting on.

import { getIO } from './io.js'
import { BROADCAST_ROOM } from './socket.js'
import type { Actor } from '../lib/actor.js'

export interface BroadcastEvent {
  action: string
  actor: Actor
  details?: Record<string, unknown>
  at?: Date
}

export function broadcastEvent(input: BroadcastEvent): void {
  try {
    const io = getIO()
    if (!io) return
    io.to(BROADCAST_ROOM).emit('audit', {
      action: input.action,
      by: input.actor.name,
      role: input.actor.role,
      details: input.details ?? {},
      at: (input.at ?? new Date()).toISOString(),
    })
  } catch {
    // Best-effort only — see file header.
  }
}
