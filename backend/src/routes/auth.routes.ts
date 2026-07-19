import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { authenticateCredentials } from '../services/auth.service.js'
import { authenticate, type JwtPayload } from '../auth/guard.js'
import { registerSession, revokeSession } from '../auth/sessions.js'

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Verify credentials, then sign a JWT the frontend stores and sends as a
  // Bearer token on every subsequent request. Each login also registers a
  // session (keyed by a fresh `jti`) so it can later be force-disconnected —
  // see auth/sessions.ts.
  app.post('/api/auth/login', async (req, reply) => {
    const { username, password } = (req.body ?? {}) as { username?: unknown; password?: unknown }
    const identity = await authenticateCredentials(username, password)
    const payload: JwtPayload = { ...identity, jti: randomUUID() }
    registerSession({ jti: payload.jti, staffId: payload.sub, name: payload.name, role: payload.role, ip: req.ip })
    const token = await reply.jwtSign(payload)
    return { token, user: { id: payload.sub, name: payload.name, role: payload.role } }
  })

  // Who am I — lets the frontend rehydrate the session from a stored token.
  app.get('/api/auth/me', { preHandler: authenticate }, async (req) => {
    return { user: req.actor }
  })

  // Best-effort session cleanup on an intentional client-side logout — keeps
  // the Control Panel's connected-devices list accurate instead of only ever
  // shrinking when someone is explicitly disconnected.
  app.post('/api/auth/logout', { preHandler: authenticate }, async (req) => {
    revokeSession((req.user as JwtPayload).jti)
    return { ok: true }
  })
}
