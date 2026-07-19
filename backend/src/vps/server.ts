// Entry point for the VPS instance — a separate OS process from the local
// server (src/server.ts), started with its own DATABASE_URL pointed at the
// central Postgres/Supabase instance (docs/05-phase-4-vps-sync.md). Reuses
// db/client.ts's PrismaClient singleton — it reads DATABASE_URL from this
// process's own environment at construction time, so running this as a
// distinct process with a distinct env is what actually separates the two
// datasources, not anything in the code itself.
import { buildVpsApp } from './app.js'
import { env } from '../env.js'

const app = buildVpsApp()

app
  .listen({ port: env.vps.port, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`Cafe Ali VPS instance listening on :${env.vps.port}`)
  })
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
