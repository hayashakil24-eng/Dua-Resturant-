// Singleton holder for the Socket.IO server. server.ts creates it once (real
// listening process); tests never call setIO, so getIO() stays null and
// broadcastAuditEvent() below no-ops — audit writes must never depend on a
// socket server existing.

import type { Server } from 'socket.io'

let io: Server | null = null

export function setIO(server: Server): void {
  io = server
}

export function getIO(): Server | null {
  return io
}
