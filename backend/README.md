# Backend

**Phases 0–4 are built** (local Fastify + Prisma REST/Socket.IO server, deployment hardening, and VPS sync — Phase 4 verified against a local SQLite stand-in for the VPS, since no real Supabase/Postgres credentials exist yet). The frontend (`../frontend/`) is wired to this backend — `AppContext.jsx` hydrates from it on mount and every mutator hits a route; login is real username/password → JWT (with a self-signup + admin-approval path on top, see `../docs/07-post-phase1-features.md`). Phase 5 (cloud-facing features) is unstarted.

Start here: [`../docs/00-overview.md`](../docs/00-overview.md) for the architecture and stack decisions, then the numbered phase files for the build order and status of each, or [`../docs/api-reference.md`](../docs/api-reference.md) for the full current route list.

An alternative on-site deployment also exists: `../control-panel/` is a single Electron app that embeds this same backend in-process (no PM2, no terminal) — see its own README. The commands below are for the standalone/PM2 deployment path.

## Running this locally

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:migrate   # applies migrations + auto-runs prisma/seed.ts
npm run dev               # tsx watch src/server.ts — listens on :4000
npm test                  # 10 files / 69 tests: core/ business logic + HTTP smoke tests
npm run build              # tsc, no emit errors expected
```

`npm test` takes ~1–2 minutes — the two HTTP smoke-test files each reseed the full real menu in `beforeAll`. If it looks stalled under a short timeout, it isn't; let it finish.

Demo logins (seeded): `admin` / `manager` / `cashier` / `kitchen`, password `1234`.

The frontend's `src/api/client.js` defaults to `http://localhost:4000`, overridable via `VITE_API_URL` — run this alongside `cd frontend && npm run dev`, or the app shows a "Cannot reach the server" state.

## Other scripts

```bash
npm run vps:dev            # tsx watch src/vps/server.ts — the Phase 4 VPS-side instance, separate port
npm run service:start       # pm2 start ecosystem.config.cjs — Phase 3 background-service deployment
npm run service:status
npm run service:logs
```

See `../docs/deployment-setup.md` for the full PM2/on-site setup, and `../docs/04-phase-3-deployment-hardening.md` / `../docs/05-phase-4-vps-sync.md` for what each of those actually does.

Next up: [Phase 5 — Cloud-Facing Features](../docs/06-phase-5-cloud-features.md) (unstarted).
