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
import { setIO, getIO } from './io.js'
import type { JwtPayload } from '../auth/guard.js'
import { isSessionValid, revokeSession } from '../auth/sessions.js'

const verify = createVerifier({ key: env.jwtSecret })

export const BROADCAST_ROOM = 'shop'

// Live connection registry — this is what the Control Panel's device list
// reads (listConnections()) and acts on (disconnectDevice()). Deliberately
// separate from auth/sessions.ts's session registry: a session stays valid
// across a brief WiFi drop (Phase 2's reconnect-resilience requirement), but
// a *connection* entry should only exist while a socket is actually open
// right now, so the "N devices connected" count stays honest.
export interface ConnectionInfo {
  socketId: string
  jti: string
  staffId: string
  name: string
  role: JwtPayload['role']
  ip: string
  connectedAt: string
}

const connections = new Map<string, ConnectionInfo>()

export function listConnections(): ConnectionInfo[] {
  return [...connections.values()]
}

// Forcibly ends one device's session: revokes the jti (so the same token
// can't just silently reconnect or keep hitting REST routes) and closes its
// live socket. Returns false if the socketId is already gone (e.g. it
// disconnected on its own between the list being read and the click).
export function disconnectDevice(socketId: string): boolean {
  const info = connections.get(socketId)
  if (!info) return false
  revokeSession(info.jti)
  getIO()?.sockets.sockets.get(socketId)?.disconnect(true)
  connections.delete(socketId)
  return true
}

export function attachSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: true },
  })

  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined
      if (!token) throw new Error('Missing token')
      const payload = (await verify(token)) as JwtPayload
      if (!isSessionValid(payload.jti)) throw new Error('Session disconnected')
      socket.data.actor = { id: payload.sub, name: payload.name, role: payload.role, jti: payload.jti }
      next()
    } catch {
      next(new Error('Authentication required.'))
    }
  })

  io.on('connection', (socket) => {
    socket.join(BROADCAST_ROOM)
    const actor = socket.data.actor as JwtPayload
    connections.set(socket.id, {
      socketId: socket.id,
      jti: actor.jti,
      staffId: actor.sub,
      name: actor.name,
      role: actor.role,
      ip: socket.handshake.address,
      connectedAt: new Date().toISOString(),
    })
    socket.on('disconnect', () => {
      connections.delete(socket.id)
    })
  })

  setIO(io)
  return io
}
