// Service-to-service credential for local-server → VPS sync (docs/05-phase-4
// -vps-sync.md: "JWT service-level credential ... distinct from individual
// staff sessions"). Same fast-jwt library @fastify/jwt already wraps (see
// realtime/socket.ts for the same pattern on the Socket.IO side), but signed
// with env.vps.syncSecret — a different key than staff sessions use, so a
// leaked staff token can never be replayed against the VPS sync endpoint.

import { createSigner, createVerifier } from 'fast-jwt'
import { env } from '../env.js'

const SERVICE_SUBJECT = 'local-server'

export function mintServiceToken(): string {
  if (!env.vps.syncSecret) throw new Error('VPS_SYNC_SECRET is not configured.')
  const sign = createSigner({ key: env.vps.syncSecret, expiresIn: 60_000 }) // 60s — minted fresh per sync run, never stored
  return sign({ sub: SERVICE_SUBJECT })
}

export async function verifyServiceToken(token: string): Promise<boolean> {
  if (!env.vps.syncSecret) return false
  try {
    const verify = createVerifier({ key: env.vps.syncSecret })
    const payload = (await verify(token)) as { sub?: string }
    return payload.sub === SERVICE_SUBJECT
  } catch {
    return false
  }
}
