import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { authenticateCredentials } from '../services/auth.service.js'
import { signup } from '../services/staff.service.js'
import { authenticateAllowPending, type JwtPayload } from '../auth/guard.js'
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

  // Public self-signup — creates a Staff row with status 'pending' and no
  // systemRole. Deliberately returns no token: the user logs in separately
  // afterward (authenticateCredentials then lets a pending account in with
  // role 'Pending' so the frontend can show a waiting screen) rather than
  // this route auto-logging them in.
  app.post('/api/auth/signup', async (req) => {
    const { name, username, password } = (req.body ?? {}) as { name?: unknown; username?: unknown; password?: unknown }
    await signup({ name: name as string, username: username as string, password: password as string })
    return { ok: true }
  })

  // Who am I — lets the frontend rehydrate the session from a stored token.
  // allowPending: a waiting-room session needs to restore itself too.
  app.get('/api/auth/me', { preHandler: authenticateAllowPending }, async (req) => {
    return { user: req.actor }
  })

  // Best-effort session cleanup on an intentional client-side logout — keeps
  // the Control Panel's connected-devices list accurate instead of only ever
  // shrinking when someone is explicitly disconnected. allowPending: a
  // waiting-room user can still sign out.
  app.post('/api/auth/logout', { preHandler: authenticateAllowPending }, async (req) => {
    revokeSession((req.user as JwtPayload).jti)
    return { ok: true }
  })
}
