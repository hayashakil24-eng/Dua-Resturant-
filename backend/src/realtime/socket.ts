// Phase 2's LAN real-time adapter — a Socket.IO server layered on top of the
// same core service layer, per docs/00-overview.md ("thin adapters on top of
// one core", not a rewrite). Every connection authenticates with the same JWT
// the REST API uses (verified with fast-jwt, the library @fastify/jwt itself
// wraps), so there's exactly one auth story for the whole app.
//
// Broadcasting is intentionally a single shared room rather than per-page
// rooms: this is a single-restaurant LAN with a handful of devices, so the
// bytes-on-wire cost of an unfiltered broadcast is negligible, and the
// frontend already only acts on the event types a given page cares about.
// Revisit with real per-department rooms only if that assumption stops
// holding (e.g. many KDS screens on a busy LAN).

import type { Server as HttpServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import { createVerifier } from 'fast-jwt'
import { env } from '../env.js'
import { setIO } from './io.js'
import type { JwtPayload } from '../auth/guard.js'

const verify = createVerifier({ key: env.jwtSecret })

export const BROADCAST_ROOM = 'shop'

export function attachSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: true },
  })

  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined
      if (!token) throw new Error('Missing token')
      const payload = (await verify(token)) as JwtPayload
      socket.data.actor = { id: payload.sub, name: payload.name, role: payload.role }
      next()
    } catch {
      next(new Error('Authentication required.'))
    }
  })

  io.on('connection', (socket) => {
    socket.join(BROADCAST_ROOM)
  })

  setIO(io)
  return io
}
