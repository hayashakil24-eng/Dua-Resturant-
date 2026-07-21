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

### What's actually deployed

The live deployment (a Contabo VPS) self-hosts Postgres via Docker directly
on the box rather than using Supabase — no managed-hosting cost, and this
project's stack choice was always "PostgreSQL", with Supabase specifically
called out as just one way to get it hosted (`00-overview.md`'s stack table).
Layout on the VPS:

- `/opt/cafeali/docker-compose.yml` — the Postgres container (`postgres:16-alpine`),
  bound to `127.0.0.1:5432` only (never exposed to the internet — nothing
  outside the VPS itself needs to reach Postgres directly, only the backend
  process running alongside it).
- `/opt/cafeali/app` — this repo, `git clone`d, built, running under PM2 as
  `cafeali-vps` (see the PM2 section above — same pattern, different entry
  point: `dist/src/vps/server.js`).
- `/opt/cafeali/certs/{cert,key}.pem` — the TLS keypair (see below).
- `ufw`: only 22 (SSH) and the backend's port open; everything else denied.

### 1. Provision Postgres

**Self-hosted via Docker** (what's actually deployed):

```bash
mkdir -p /opt/cafeali/postgres-data
# docker-compose.yml — postgres:16-alpine, bind 127.0.0.1:5432 only,
# volume at /opt/cafeali/postgres-data, restart: unless-stopped
docker compose up -d
```

**Or Supabase**, if you'd rather not self-host: create a project, then from
**Project Settings → Database** copy the **pooled** connection string (port
6543, `?pgbouncer=true`) — not the direct one (port 5432). Prisma needs the
pooled string because the VPS process can open more connections over its
lifetime than Supabase's direct-connection limit allows on the smaller
tiers. Either way, nothing else in this doc changes — same migrations, same
`DATABASE_URL` shape (Postgres is Postgres).

### 2. TLS — no domain, so a self-signed cert pinned by the local server

The client explicitly doesn't want a domain, which rules out a public CA
(Let's Encrypt et al. cannot issue a certificate for a bare IP — there's
nothing for it to domain-validate). Instead: a long-lived self-signed
certificate for the VPS's IP, and the local server pins it explicitly rather
than trusting a public CA at all — for service-to-service traffic like this,
pinning is arguably *stronger* than public-CA trust anyway, since it can't be
fooled by a mis-issued cert from an unrelated CA.

Generate the keypair **on the VPS itself** — the private key must never
leave it:

```bash
mkdir -p /opt/cafeali/certs && chmod 700 /opt/cafeali/certs
openssl req -x509 -newkey rsa:4096 \
  -keyout /opt/cafeali/certs/key.pem -out /opt/cafeali/certs/cert.pem \
  -days 3650 -nodes -subj "/CN=<VPS_IP>" -addext "subjectAltName=IP:<VPS_IP>"
chmod 600 /opt/cafeali/certs/key.pem
```

`-addext subjectAltName=IP:<VPS_IP>` is required, not optional — modern TLS
clients (including Node's) reject a cert that only matches via the legacy
`CN` field. 10-year expiry because this is manually managed, not
auto-renewed like Let's Encrypt — put a reminder somewhere for ~2036.

Copy just the **public** half back into the repo — certs are meant to be
public, only the private key is sensitive:

```bash
scp root@<VPS_IP>:/opt/cafeali/certs/cert.pem backend/certs/vps-self-signed.pem
git add backend/certs/vps-self-signed.pem && git commit -m "..." && git push
```

The local server trusts it via `NODE_EXTRA_CA_CERTS`, already wired into
`ecosystem.config.cjs`'s `env` block pointing at
`backend/certs/vps-self-signed.pem` — this **must** be a real process-level
env var (PM2's `env` block spawns the child process with it already set), not
something loaded from `backend/.env` at runtime: `src/env.ts`'s
`loadEnvFile()` runs after Node has already initialized its TLS trust store,
so a value that only exists in `.env` is silently too late. Nothing to do
here if you're not running under the provided `ecosystem.config.cjs` other
than replicating that same rule.

### 3. Configure the VPS's own `.env`

This is a separate `.env` from the local server's — see the VPS section of
`backend/.env.example` for the exact shape:

```bash
DATABASE_URL="postgresql://cafeali:PASSWORD@127.0.0.1:5432/cafeali"
VPS_SYNC_SECRET="<openssl rand -hex 32>"   # must match nothing else — distinct from JWT_SECRET
VPS_PORT=5000
VPS_TLS_CERT_PATH="/opt/cafeali/certs/cert.pem"
VPS_TLS_KEY_PATH="/opt/cafeali/certs/key.pem"
```

And on the local server's own `.env` (the restaurant PC, not the VPS):

```bash
VPS_URL="https://<VPS_IP>:5000"
VPS_SYNC_SECRET="<the exact same value configured on the VPS above>"
```

### 4. Install, migrate, build, start

```bash
cd backend
npm install
npm run vps:prisma:migrate:deploy   # applies prisma/postgres/migrations/ to the real Postgres DB
npm run vps:prisma:generate         # generates the Postgres-flavored Prisma Client for this deploy
npm run build
npm run vps:start                   # node dist/src/vps/server.js — or under PM2, see below
```

Put `vps:start` under the same PM2 pattern as the local server if the VPS
host should also survive reboots/crashes unattended — `ecosystem.config.cjs`
is written for the local server's entry point specifically
(`dist/src/server.js`); a VPS deployment needs its own PM2 app entry pointed
at `dist/src/vps/server.js` instead, following the same `autorestart`/
`exp_backoff_restart_delay` shape (what's actually deployed uses exactly
that, named `cafeali-vps`, under its own `ecosystem.vps.config.cjs`).

### 5. Firewall

```bash
ufw allow 22/tcp
ufw allow 5000/tcp   # or whatever VPS_PORT is set to
ufw --force enable
```

Postgres (5432) is deliberately **not** opened — it's bound to `127.0.0.1`
already (docker-compose above), so only the backend process on the same box
can reach it; there's no reason for it to be internet-facing at all.

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
