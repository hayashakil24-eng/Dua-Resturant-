// Route guards: JWT verification + server-side permission enforcement.
//
// This is the structural fix docs/02-phase-1 calls for — in the frontend
// several mutators were gated only in the UI. Here every mutating route is
// wrapped in requirePermission(pageKey), so "no independent permission check"
// is impossible: the check runs before the handler, using the same
// core/permissions.ts matrix the frontend uses (canModify for mutations,
// hasAccess for read/page access).

import type { FastifyReply, FastifyRequest } from 'fastify'
import { canModify, hasAccess, type PageKey, type Role } from '../core/permissions.js'
import type { Actor } from '../lib/actor.js'
import { isSessionValid } from './sessions.js'

export interface JwtPayload {
  sub: string // Staff.id
  name: string
  role: Role // systemRole
  jti: string // session id — checked against the active-session registry, see sessions.ts
}

// Shared verification: JWT signature + active-session check, populates
// req.actor. `allowPending` decides whether a self-signup account still
// awaiting Admin review (role 'Pending') is accepted or rejected here — kept
// as an internal-only parameter (not on `authenticate` itself) because
// Fastify's preHandler typing resolves a bare function reference against its
// callback-style hook signature `(req, reply, done)` the moment that
// function has any 3rd parameter, which breaks every route below that passes
// `authenticate` bare (`preHandler: authenticate`, ~18+ routes) rather than
// wrapped in a closure. Two thin 2-arg exports avoid that entirely.
async function verify(req: FastifyRequest, reply: FastifyReply, allowPending: boolean): Promise<void> {
  try {
    await req.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'Authentication required.' })
    return
  }
  const p = req.user as JwtPayload
  if (!isSessionValid(p.jti)) {
    reply.code(401).send({ error: 'This session has been disconnected. Please log in again.' })
    return
  }
  req.actor = { id: p.sub, name: p.name, role: p.role }
  if (req.actor.role === 'Pending' && !allowPending) {
    reply.code(403).send({ error: 'Your account is pending admin approval.' })
  }
}

// Populate req.actor from a verified token, or 401/403. Every guarded route
// runs this first (directly, or via requirePermission) — a 'Pending' session
// is rejected here, before ever reaching a handler, since most routes below
// only ever checked "is this any valid Staff session" with no further
// page-permission check (safe until self-signup existed, since every session
// necessarily belonged to an admin-provisioned account until now).
export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  return verify(req, reply, false)
}

// The couple of routes a 'Pending' session legitimately needs — session
// restore and sign-out. Everything else uses `authenticate` above.
export async function authenticateAllowPending(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  return verify(req, reply, true)
}

// A preHandler enforcing a permission on a page/feature key. `mode`:
//   'modify' — canModify (full/edit/create) — the default, for mutations
//   'access' — hasAccess (anything but hidden) — for read routes
export function requirePermission(pageKey: PageKey, mode: 'modify' | 'access' = 'modify') {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(req, reply)
    if (reply.sent) return
    const allowed = mode === 'modify' ? canModify(req.actor.role, pageKey) : hasAccess(req.actor.role, pageKey)
    if (!allowed) {
      reply.code(403).send({ error: 'You do not have permission to perform this action.' })
    }
  }
}

// Some frontend mutators are reachable from more than one page and accept any
// of several permissions (e.g. markPaid is allowed from Orders OR Billing).
// This mirrors that: allow if canModify holds for ANY of the keys.
export function requireAnyPermission(pageKeys: PageKey[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(req, reply)
    if (reply.sent) return
    if (!pageKeys.some((k) => canModify(req.actor.role, k))) {
      reply.code(403).send({ error: 'You do not have permission to perform this action.' })
    }
  }
}

// A few mutators are gated by explicit role rather than a page key — the
// frontend checks e.g. `user.role !== 'Admin'` directly (approveIngredientRequest,
// deleteStaff/deleteTable are Admin-only; handover accept/reject are
// Manager/Admin). This mirrors that check server-side.
export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticate(req, reply)
    if (reply.sent) return
    if (!roles.includes(req.actor.role)) {
      reply.code(403).send({ error: 'You do not have permission to perform this action.' })
    }
  }
}

// Fastify/JWT type augmentation so req.actor and the decoded payload are typed.
declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor
  }
}
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}
