# Server deployment setup

Covers both deployment targets: the **local server** (Phase 3, one-time setup
on the actual restaurant PC — not something to run in a dev sandbox, since
`pm2 startup` registers a boot-time OS service) and the **VPS server** (Phase
4 hardening, below).

## Install & build

```bash
cd backend
npm install
npm run build
npm run prisma:migrate   # or `prisma migrate deploy` for an existing DB
```

## Start under PM2

```bash
npm run service:start      # pm2 start ecosystem.config.cjs
npm run service:status     # confirm it's online
npm run service:logs       # tail logs
```

## Make it survive a reboot

**Windows** (the actual target per `../requirements.md` §12):
```bash
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```

**Linux** (if ever deployed there):
```bash
pm2 startup
pm2 save
```

Either way, `pm2 save` snapshots the currently-running process list so
`pm2 startup`/`pm2-startup install` restores it on boot. Re-run `pm2 save`
after any change to `ecosystem.config.cjs`.

## Day to day

- `npm run service:restart` after deploying new code (`npm run build` first).
- `npm run service:status` / `npm run service:logs` for the "is it up" /
  "what happened" questions from docs' "basic operational visibility" bullet
  — the frontend's Settings panel (below) covers the common case so this is
  only needed for actual troubleshooting.

## VPS server deployment (Phase 4 hardening)

The local server (above) needs nothing from this section to work — Phases
1–3 are fully self-contained. This is only for standing up the central VPS
instance that the local server's background sync job pushes to
(`docs/05-phase-4-vps-sync.md`).

`prisma/schema.prisma` is SQLite-only (`datasource db { provider = "sqlite" }`)
— that's the local server's schema and stays that way. The VPS needs the same
26 models against PostgreSQL instead, so a second schema is **generated** from
the canonical one rather than hand-maintained in parallel:
`prisma/postgres/schema.prisma` (gitignored — always regenerated, never
edited directly) via `npm run vps:schema:build`. All `vps:prisma:*` scripts
run that build step automatically. If you change `prisma/schema.prisma`,
regenerate a matching Postgres migration:

```bash
npm run vps:prisma:migrate:dev   # only when the schema actually changed —
                                  # creates a new file under prisma/postgres/migrations/
```

### 1. Provision Postgres (Supabase)

Create a Supabase project, then from **Project Settings → Database** copy the
**pooled** connection string (port 6543, `?pgbouncer=true`) — not the direct
one (port 5432). Prisma needs the pooled string because the VPS process can
open more connections over its lifetime than Supabase's direct-connection
limit allows on the smaller tiers. Supabase itself is used purely as managed
Postgres hosting here — no Supabase Auth/Realtime/auto-API involved (see
`00-overview.md`'s stack table).

### 2. Configure the VPS's own `.env`

This is a separate `.env` from the local server's — see the VPS section of
`backend/.env.example` for the exact shape:

```bash
DATABASE_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
VPS_SYNC_SECRET="<openssl rand -hex 32>"   # must match nothing else — distinct from JWT_SECRET
VPS_PORT=5000
```

### 3. Install, migrate, build, start

```bash
cd backend
npm install
npm run vps:prisma:migrate:deploy   # applies prisma/postgres/migrations/ to the real Postgres DB
npm run vps:prisma:generate         # generates the Postgres-flavored Prisma Client for this deploy
npm run build
npm run vps:start                   # node dist/src/vps/server.js
```

Put `vps:start` under the same PM2 pattern as the local server if the VPS
host should also survive reboots/crashes unattended — `ecosystem.config.cjs`
is written for the local server's entry point specifically
(`dist/src/server.js`); a VPS deployment needs its own PM2 app entry pointed
at `dist/src/vps/server.js` instead, following the same `autorestart`/
`exp_backoff_restart_delay` shape.

### Verifying the Postgres path without a live Supabase project

`npm run verify:postgres` boots a real, disposable Postgres engine locally
(via the `embedded-postgres` devDependency — no Docker/sudo/external service
needed), applies `prisma/postgres/migrations/`, generates a client against
it, and round-trips an actual sync push through `buildVpsApp()` — including a
repeated push, to confirm the upsert stays idempotent. Run it after touching
`prisma/schema.prisma` or `src/vps/`. It's deliberately not part of `npm test`
(downloading/booting a real Postgres cluster is slow and shouldn't gate the
fast SQLite-backed suite) — see `docs/05-phase-4-vps-sync.md`'s verification
notes for exactly what this does and doesn't prove versus a real Supabase
deployment.
