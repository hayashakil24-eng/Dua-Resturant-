# Phase 4 — VPS + Sync

**Status: ✅ built and verified against a local stand-in for the VPS** (no real Supabase/Postgres credentials were available — see "Verification notes" below for exactly what that does and doesn't prove).

Adds the central, always-on store. Genuinely additive — the local server (Phases 1–3) keeps working exactly as before if the VPS is unreachable, which is the entire point given the restaurant's unreliable internet.

## Goal

Everything that happens locally eventually lands in one central Postgres database, without day-to-day operations ever waiting on that to happen.

## Scope

- Stand up the second Fastify instance on the VPS — same core service layer from Phase 0, pointed at PostgreSQL (hosted via Supabase, managed-Postgres-only, per `00-overview.md`) instead of SQLite. No Socket.IO/local real-time layer needed here; that's a LAN concern.
- Add an outbox table locally: every write that matters (new order, payment, stock adjustment, etc.) also logs a row marked "pending sync."
- Background job on the local server: check for connectivity periodically, and when available, push pending outbox rows to the VPS API, marking them synced on success.
- Retry/backoff handling for failed pushes (connectivity can flap, not just drop cleanly) — doesn't need to be a full message queue (deliberately not chosen, see `00-overview.md`), but does need to not silently drop a row after one failed attempt.
- JWT service-level credential for the local server to authenticate to the VPS API, distinct from individual staff sessions.

## Frontend alignment

None directly — the frontend keeps talking only to the local server, exactly as in Phases 1–2. Sync is entirely a local-server-to-VPS concern; the Electron app doesn't need to know the VPS exists. The one exception: Phase 3's "server health" surface in `Settings.jsx` gets a new field (last successful sync time) once this phase exists.

## Done when

- Data written locally while offline shows up in the VPS Postgres database within one sync interval after connectivity returns, with no manual intervention.
- Killing connectivity mid-sync doesn't duplicate or lose records — a retried push is safe to repeat.
- The local server's day-to-day behavior (Phases 1–2) is provably unaffected by the VPS being down for an extended period.

## What was built

- **Outbox table**: `OutboxEntry` (schema.prisma) — one row per synced write, storing the entity name, entity id, and a full-current-state JSON snapshot (not a diff/action) so a push is a plain idempotent upsert on the VPS side. Enqueued explicitly at a focused set of call sites matching the docs' own example list — `addOrder`/`markPaid`/`cancelOrder` (orders.service.ts), `addTransaction` (accounting.service.ts), `adjustStock`/`restock` (inventory.service.ts). Not instrumented at every mutation the way the audit log is — extending to more entities is the same one-line `enqueueOutbox(tx, entity, id, row)` pattern repeated.
- **VPS instance**: `src/vps/` — a deliberately separate, smaller Fastify app (no Socket.IO/LAN discovery/backup — those are on-site concerns), with one generic `POST /api/sync/push` that upserts a batch of outbox entries by entity name, authenticated by a service-level JWT (`src/vps/serviceAuth.ts`, signed/verified with `VPS_SYNC_SECRET` — deliberately a different secret than staff-session `JWT_SECRET`). `npm run vps:dev` / `vps:start`.
- **Local sync job**: `src/sync/job.ts` — every `VPS_SYNC_INTERVAL_MS` (default 30s), checks VPS reachability via `/api/health`, and if reachable, pushes due rows in one batch. A row's own `lastAttemptAt` + exponential backoff (`5s * 2^attempts`, capped at 5min) decides whether it's "due" — a flapping connection doesn't get hammered every tick. Never blocks a request: this is a bare `setInterval`, not anything a route handler awaits.
- **Frontend**: `Settings.jsx`'s health card gets a "Last VPS sync" row (+ pending count) once `vpsConfigured` is true — hidden entirely for a plain local-only deployment, per the docs' own frontend-alignment note.

## Verification notes

No real Postgres/Supabase instance was available (no credentials, and this sandbox has neither a usable Docker integration nor installable PostgreSQL). Per explicit sign-off, verification used a **second local SQLite database standing in for "the VPS"** — a second `src/vps/server.ts` process on its own port, pointed at its own SQLite file via its own `DATABASE_URL`, using the exact same Prisma schema (which the schema's own header comment already commits to being datasource-agnostic).

**What this proves**: the actual sync protocol and failure handling, end to end —
- A freshly-placed order appeared correctly on the "VPS" side within one sync interval, byte-for-byte matching (same id, orderNumber, table, waiter, payment status).
- Three orders placed **while the VPS process was killed** queued as `pending` outbox rows; local API responses stayed fast (~10ms) throughout — day-to-day operation is provably unaffected by VPS downtime.
- Bringing the VPS back up, all three caught up automatically on the next sync tick with zero manual intervention, each landing exactly once (re-running another sync cycle left the VPS row count unchanged — already-`synced` rows are correctly excluded from future push batches, so a retried/repeated interval never duplicates).

**A real bug this caught**: the first version of the outbox payload stored the UI-shaped `serializeOrder()` DTO (computed `displayId`, frontend cart-key `items` array) instead of the raw Prisma row — which would have failed against a real upsert schema-shape check every single time. Fixed to strip relations and store the plain scalar row before this was ever exercised against the "VPS" for real.

**A real design gap this surfaced**: `orderNumber`/`txnNumber` carry a per-database `@unique` constraint (needed for local display-id integrity), but are **not** globally unique across independently-seeded databases — colliding values (e.g. from resetting a local dev database's sequence back to 1) make the VPS-side upsert's `create` branch fail with a unique-constraint error, and the row retries forever without ever succeeding. This didn't come up in the clean verification run above (a real single restaurant's `orderNumber` sequence only ever increments, never resets), but it's a real gap worth closing before Phase 5's cross-location aggregation, where two different restaurants' local databases could legitimately produce the same `orderNumber` for different orders. Phase 0's own docs already anticipated this — cuid `id` was chosen specifically for being "globally unique, safe for Phase 4 sync"; `orderNumber` was always meant to be a local display field only. Worth a follow-up: either drop the VPS-side uniqueness expectation on `orderNumber`/`txnNumber` entirely (id is the only true sync key) or scope it per-location once Phase 5 introduces multiple locations.

**Not verifiable here, needs the real infrastructure**: actual Postgres/Supabase-specific behavior (connection pooling, SSL, managed-hosting quirks), a real network hop between the restaurant and a VPS (this test ran everything on one machine over loopback), and the `provider = "postgresql"` schema swap a real deployment needs (Prisma's datasource provider is fixed at `generate` time per schema file — the local and VPS deployments will need their own schema file or a build step that swaps this, not just a different `DATABASE_URL`, which is as far as this local simulation needed to go).
