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
- `/etc/letsencrypt/live/<hostname>.sslip.io/` — the real TLS keypair
  (certbot-managed, auto-renewing; see below).
- `ufw`: only 22 (SSH), 80 (certbot renewal), and 443 (the backend) open;
  everything else denied.

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

### 2. TLS — a real certificate via a free hostname, no domain purchase

The client explicitly doesn't want to buy a domain — but a *public CA*
certificate turned out to be a hard requirement anyway, not just a nice-to-
have: the WhatsApp Cloud API webhook (see below) needs one, since Meta
rejects self-signed certs outright when validating a webhook callback URL.
An early version of this doc used a self-signed cert pinned via
`NODE_EXTRA_CA_CERTS`, which worked fine for the local↔VPS sync connection
but couldn't satisfy that requirement. The fix: **sslip.io** — a free service
that turns any IP into a real, resolvable hostname with zero signup (e.g.
`169-58-53-109.sslip.io` resolves straight to `169.58.53.109`) — which is a
real domain as far as Let's Encrypt is concerned, so `certbot` can issue an
actual publicly-trusted certificate for it. This replaced the self-signed
approach entirely; the local server no longer needs any special TLS trust
configuration at all, since a real cert is already in Node's default trust
store.

On the VPS:

```bash
apt-get install -y certbot
ufw allow 80/tcp   # needed for the HTTP-01 challenge, and for renewal later
pm2 stop cafeali-vps   # frees the port certbot's standalone mode needs

certbot certonly --standalone -d <IP-WITH-DASHES>.sslip.io \
  --non-interactive --agree-tos --register-unsafely-without-email
```

Certbot writes to `/etc/letsencrypt/live/<hostname>/{fullchain,privkey}.pem`
and installs its own renewal timer automatically — nothing further to do for
the ~90-day renewal cycle. `--register-unsafely-without-email` skips
Let's Encrypt's expiry-notice email, fine for a test/non-critical deployment;
drop that flag and pass `-m you@example.com` for a real one.

### 3. Configure the VPS's own `.env`

This is a separate `.env` from the local server's — see the VPS section of
`backend/.env.example` for the exact shape:

```bash
DATABASE_URL="postgresql://cafeali:PASSWORD@127.0.0.1:5432/cafeali"
VPS_SYNC_SECRET="<openssl rand -hex 32>"   # must match nothing else — distinct from JWT_SECRET
VPS_PORT=443   # must be 443/80/88/8443 — Meta's permitted webhook ports
VPS_TLS_CERT_PATH="/etc/letsencrypt/live/<hostname>.sslip.io/fullchain.pem"
VPS_TLS_KEY_PATH="/etc/letsencrypt/live/<hostname>.sslip.io/privkey.pem"
WHATSAPP_PHONE_NUMBER_ID="..."
WHATSAPP_ACCESS_TOKEN="..."
WHATSAPP_WEBHOOK_VERIFY_TOKEN="<openssl rand -hex 20>"
WHATSAPP_REPORT_RECIPIENT="923001234567"   # who the webhook will reply to — digits only
```

And on the local server's own `.env` (the restaurant PC, not the VPS) —
notably, no `NODE_EXTRA_CA_CERTS` or any other TLS trust config needed,
since the cert above is real:

```bash
VPS_URL="https://<hostname>.sslip.io"
VPS_SYNC_SECRET="<the exact same value configured on the VPS above>"
WHATSAPP_PHONE_NUMBER_ID="..."   # same value as the VPS's .env
WHATSAPP_ACCESS_TOKEN="..."      # same value as the VPS's .env
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
ufw allow 80/tcp    # certbot's HTTP-01 challenge, both initial + renewal
ufw allow 443/tcp   # or whatever VPS_PORT is set to
ufw --force enable
```

Postgres (5432) is deliberately **not** opened — it's bound to `127.0.0.1`
already (docker-compose above), so only the backend process on the same box
can reach it; there's no reason for it to be internet-facing at all.

### 6. WhatsApp Cloud API — the one manual step

Everything above is scriptable; registering the webhook itself isn't — it's
a one-time step in the Meta App Dashboard that only someone with access to
that Meta Business account can do:

1. Meta App Dashboard → your app → **WhatsApp → Configuration**.
2. **Callback URL**: `https://<hostname>.sslip.io/webhook/whatsapp`
3. **Verify token**: the exact value of `WHATSAPP_WEBHOOK_VERIFY_TOKEN` from
   the VPS's `.env` above.
4. Save — Meta immediately sends a GET request to the callback URL with that
   token; `src/whatsapp/webhook.ts` echoes back `hub.challenge` only if it
   matches, which is what confirms the registration to Meta.
5. Under **Webhook fields**, subscribe to `messages` — without this, Meta
   never forwards inbound messages at all, regardless of the callback URL
   being correctly registered.

Test-mode WhatsApp numbers (the default for a fresh Meta app, before
business verification) can only message phone numbers explicitly added and
OTP-verified as allowed recipients in the same dashboard section — a real
constraint independent of anything above, since it governs what Meta's test
number is willing to send to at all, not whether the webhook works.

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
