// Password/PIN hashing via Node's built-in scrypt — no native dependency
// (bcrypt/argon2 need a compiler on the restaurant PC's Windows install, which
// docs/03-phase-3 wants to keep to a plain, non-technical setup). scrypt is
// memory-hard and ships in node:crypto, so it's the pragmatic choice here.
//
// Stored format: `scrypt$<saltHex>$<hashHex>`. Verification is constant-time.

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

const KEYLEN = 64

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, KEYLEN)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1]!, 'hex')
  const expected = Buffer.from(parts[2]!, 'hex')
  const actual = await scrypt(password, salt, expected.length)
  // Lengths always match here (same KEYLEN), but guard anyway — timingSafeEqual
  // throws on a length mismatch.
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
