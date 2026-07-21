// Fastify app assembly. Split from server.ts (which listens) so tests can build
// a ready app and inject requests without binding a port.
//
// This is the REST adapter over the core service layer — per
// docs/00-overview.md, business logic lives in src/services + src/core, and
// routes are thin. Phase 2's Socket.IO and Phase 4's VPS instance are meant to
// be additional adapters on that same core, not rewrites of it.

import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import sensible from '@fastify/sensible'
import { env } from './env.js'
import { ServiceError } from './lib/errors.js'
import { authRoutes } from './routes/auth.routes.js'
import { orderRoutes } from './routes/orders.routes.js'
import { inventoryRoutes } from './routes/inventory.routes.js'
import { recipeRoutes } from './routes/recipes.routes.js'
import { shiftRoutes } from './routes/shifts.routes.js'
import { receivableRoutes } from './routes/receivables.routes.js'
import { menuRoutes } from './routes/menu.routes.js'
import { tableRoutes } from './routes/tables.routes.js'
import { staffRoutes } from './routes/staff.routes.js'
import { departmentRoutes } from './routes/departments.routes.js'
import { accountingRoutes } from './routes/accounting.routes.js'
import { settingsRoutes } from './routes/settings.routes.js'
import { closingRoutes } from './routes/closing.routes.js'
import { attendanceRoutes } from './routes/attendance.routes.js'
import { auditRoutes } from './routes/audit.routes.js'
import { systemRoutes } from './routes/system.routes.js'

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: process.env.LOG_LEVEL ?? 'info' },
  })

  // The Electron renderer (dev: http://localhost:5173) and any LAN device talk
  // to this over HTTP with a Bearer token — no cookies, so a permissive CORS
  // origin is fine; auth is enforced by the JWT, not the origin.
  // Explicit method list — the renderer uses PATCH/PUT/DELETE (edit table,
  // update menu, remove discount, …); the default preflight advertised only
  // GET/HEAD/POST, which the browser would use to block the others.
  app.register(cors, { origin: true, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] })
  app.register(sensible)
  // Sessions are also revocable in real time (auth/sessions.ts's jti
  // registry — the Control Panel's "disconnect device"), but a signature-
  // valid token had no time limit of its own before this: a leaked token
  // stayed usable indefinitely against a long-uptime server. 24h is generous
  // enough that no one on a normal shift ever notices it, while still
  // bounding how long a leaked token stays useful.
  app.register(jwt, { secret: env.jwtSecret, sign: { expiresIn: '24h' } })
  // global: false — this app's other routes see plenty of legitimate rapid
  // traffic (POS order entry, live sync); only auth's specific brute-force
  // surface needs throttling, applied per-route below. Skipped under test:
  // the test suite legitimately exercises many signup/login scenarios in
  // quick succession from the same fake IP app.inject() uses — real usage
  // (a handful of signups ever) is nowhere near these limits, but a test
  // run comfortably is.
  if (process.env.NODE_ENV !== 'test') {
    app.register(rateLimit, { global: false })
  }

  // Map service-layer errors to HTTP. A ServiceError carries its own status
  // (400/401/403/404); anything else is an unexpected 500 and gets logged.
  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof ServiceError) {
      return reply.code(err.statusCode).send({ error: err.message })
    }
    // Fastify schema-validation failures surface as 400 with a readable message.
    if (err.validation) {
      return reply.code(400).send({ error: err.message })
    }
    // Other plugins (e.g. @fastify/rate-limit's 429) throw their own errors
    // with a valid client-error statusCode already set — surfaced this when
    // rate-limiting was added: without this branch, a 429 was silently
    // rewritten to a generic 500 below, which not only hid the real reason
    // but meant a rate-limited client couldn't tell "back off" from "server
    // broke" and had no reason to retry-with-delay instead of hammering it.
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.message })
    }
    req.log.error(err)
    return reply.code(500).send({ error: 'Internal server error.' })
  })

  app.get('/api/health', async () => ({ ok: true }))
  app.register(authRoutes)
  app.register(orderRoutes)
  app.register(inventoryRoutes)
  app.register(recipeRoutes)
  app.register(shiftRoutes)
  app.register(receivableRoutes)
  app.register(menuRoutes)
  app.register(tableRoutes)
  app.register(staffRoutes)
  app.register(departmentRoutes)
  app.register(accountingRoutes)
  app.register(settingsRoutes)
  app.register(closingRoutes)
  app.register(attendanceRoutes)
  app.register(auditRoutes)
  app.register(systemRoutes)

  return app
}
