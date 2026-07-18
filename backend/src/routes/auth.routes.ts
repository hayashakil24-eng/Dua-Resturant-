import type { FastifyInstance } from 'fastify'
import { authenticateCredentials } from '../services/auth.service.js'
import { authenticate } from '../auth/guard.js'

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Verify credentials, then sign a JWT the frontend stores and sends as a
  // Bearer token on every subsequent request.
  app.post('/api/auth/login', async (req, reply) => {
    const { username, password } = (req.body ?? {}) as { username?: unknown; password?: unknown }
    const payload = await authenticateCredentials(username, password)
    const token = await reply.jwtSign(payload)
    return { token, user: { id: payload.sub, name: payload.name, role: payload.role } }
  })

  // Who am I — lets the frontend rehydrate the session from a stored token.
  app.get('/api/auth/me', { preHandler: authenticate }, async (req) => {
    return { user: req.actor }
  })
}
