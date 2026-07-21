#!/usr/bin/env node
// Real-Postgres verification for the VPS deployment (docs/05-phase-4-vps-sync.md
// flagged this as "not verifiable here, needs the real infrastructure" — Phase
// 4's own verification only ever ran against a second SQLite database standing
// in for "the VPS"). This script runs the actual VPS migration + upsert path
// against a real, disposable Postgres engine (via `embedded-postgres`, a
// devDependency — no Docker/sudo/external service required), so schema drift
// or SQLite-only assumptions get caught locally instead of on the real VPS.
//
// Deliberately NOT part of `npm test` / CI's default path: it downloads and
// boots a real Postgres cluster, which is slow and shouldn't gate the fast
// SQLite-backed suite that runs on every change. Run it explicitly with
// `npm run verify:postgres` after touching prisma/schema.prisma or the VPS
// sync/upsert code.

import EmbeddedPostgres from 'embedded-postgres'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDir = dirname(dirname(fileURLToPath(import.meta.url)))
const dataDir = mkdtempSync(join(tmpdir(), 'cafeali-pg-verify-'))
const PORT = 55432
const DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: false,
})

function run(cmd, args) {
  console.log(`$ ${cmd} ${args.join(' ')}`)
  execFileSync(cmd, args, {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL },
  })
}

let exitCode = 0
try {
  console.log('Starting a real, disposable Postgres cluster...')
  await pg.initialise()
  await pg.start()

  console.log('\nApplying the VPS migration history to it (npm run vps:prisma:migrate:deploy)...')
  run('npm', ['run', 'vps:prisma:migrate:deploy'])

  console.log('\nGenerating a Prisma client against the postgres schema...')
  run('npx', ['prisma', 'generate', '--schema', 'prisma/postgres/schema.prisma'])

  console.log('\nExercising the actual sync upsert path end-to-end (buildVpsApp + PrismaClient, both pointed at this Postgres)...')
  process.env.DATABASE_URL = DATABASE_URL
  process.env.VPS_SYNC_SECRET = 'verify-postgres-test-secret'
  const { buildVpsApp } = await import('../src/vps/app.js')
  const { mintServiceToken } = await import('../src/vps/serviceAuth.js')
  const { prisma } = await import('../src/db/client.js')

  const app = buildVpsApp()
  const token = mintServiceToken()
  const orderId = 'verify-pg-order-1'

  const res = await app.inject({
    method: 'POST',
    url: '/api/sync/push',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      entries: [
        {
          id: 'outbox-1',
          entity: 'Order',
          entityId: orderId,
          payload: {
            id: orderId,
            orderNumber: 999001,
            table: 1,
            waiter: 'verify-waiter',
            payment: 'Unpaid',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      ],
    },
  })

  const body = res.json()
  if (res.statusCode !== 200 || !body.results?.[0]?.ok) {
    throw new Error(`Sync push did not succeed: ${res.statusCode} ${JSON.stringify(body)}`)
  }

  const row = await prisma.order.findUnique({ where: { id: orderId } })
  if (!row || row.orderNumber !== 999001) {
    throw new Error(`Order did not land correctly in real Postgres: ${JSON.stringify(row)}`)
  }

  // Push the same entry again — Phase 4's own "done when" criterion is that a
  // retried push is safe to repeat (idempotent upsert), not just the first one.
  const res2 = await app.inject({
    method: 'POST',
    url: '/api/sync/push',
    headers: { authorization: `Bearer ${token}` },
    payload: { entries: [{ id: 'outbox-1', entity: 'Order', entityId: orderId, payload: { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() } }] },
  })
  if (res2.statusCode !== 200 || !res2.json().results?.[0]?.ok) {
    throw new Error(`Repeated sync push failed: ${res2.statusCode} ${JSON.stringify(res2.json())}`)
  }
  const countAfterRetry = await prisma.order.count({ where: { id: orderId } })
  if (countAfterRetry !== 1) {
    throw new Error(`Repeated push duplicated the row instead of upserting: ${countAfterRetry} rows`)
  }

  await app.close()
  await prisma.$disconnect()

  console.log('\n✅ Real-Postgres verification passed: migration applied cleanly, sync push landed correctly, repeat push stayed idempotent.')
} catch (err) {
  console.error('\n❌ Real-Postgres verification failed:', err)
  exitCode = 1
} finally {
  try {
    await pg.stop()
  } catch {
    /* already stopped/never started */
  }
  rmSync(dataDir, { recursive: true, force: true })

  // `prisma generate --schema prisma/postgres/schema.prisma` above overwrites
  // the same node_modules/@prisma/client this repo's SQLite-backed local dev
  // server and tests use (Prisma doesn't namespace the generated client by
  // provider). Regenerate the SQLite client before exiting so `npm run dev` /
  // `npm test` aren't left pointed at a Postgres-flavored client afterward.
  console.log('\nRegenerating the local SQLite Prisma client (restoring dev environment)...')
  execFileSync('npx', ['prisma', 'generate'], { cwd: backendDir, stdio: 'inherit' })
}

process.exit(exitCode)
