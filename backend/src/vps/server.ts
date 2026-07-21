// Entry point for the VPS instance — a separate OS process from the local
// server (src/server.ts), started with its own DATABASE_URL pointed at the
// central Postgres/Supabase instance (docs/05-phase-4-vps-sync.md). Reuses
// db/client.ts's PrismaClient singleton — it reads DATABASE_URL from this
// process's own environment at construction time, so running this as a
// distinct process with a distinct env is what actually separates the two
// datasources, not anything in the code itself.
import { readFileSync } from 'node:fs'
import { buildVpsApp } from './app.js'
import { env } from '../env.js'

// No domain for this deployment (docs/deployment-setup.md's "VPS server
// deployment" section) — a public CA can't issue a cert for a bare IP, so
// this is a long-lived self-signed cert instead, pinned by the local
// server's sync job via NODE_EXTRA_CA_CERTS (set at process-spawn time, not
// in .env — Node reads that env var before any app code runs).
const https =
  env.vps.tlsCertPath && env.vps.tlsKeyPath
    ? { cert: readFileSync(env.vps.tlsCertPath), key: readFileSync(env.vps.tlsKeyPath) }
    : undefined

const app = buildVpsApp({ https })

app
  .listen({ port: env.vps.port, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`Cafe Ali VPS instance listening on :${env.vps.port} (${https ? 'https' : 'http'})`)
  })
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
