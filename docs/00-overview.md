# Backend Architecture Overview

Status: **Phases 0–4 built and verified** (Phase 4 against a local stand-in for the VPS — no real Supabase/Postgres credentials available yet). Phase 5 is unstarted scope, not yet broken into sub-tasks. A batch of feature work landed on top of the finished phases since this doc set was first written — staff self-signup/approval, recipe edit/delete, table-shift, and the full business-day close — see [`07-post-phase1-features.md`](07-post-phase1-features.md), which none of the phase docs below describe. See the phase index below for each phase's own status line, [`api-reference.md`](api-reference.md) for the current full route list, and `../backend/README.md` for how to run what exists today. An alternative on-site deployment, `../control-panel/` (a single Electron app embedding this same backend), also exists alongside the PM2-based deployment Phase 3 describes — see `../control-panel/README.md`.

## Why a backend at all

`../requirements.md` §11–§12 describe an offline-first desktop app backed by a dedicated local PC "server," with real-time state shared across multiple cashiers (§9) and a kitchen display (§10). `localStorage` (the frontend's original persistence, before Phase 1) is per-device and cannot satisfy either of those — this is the reason a backend is needed, not a rewrite for its own sake.

Additional context gathered during planning (not yet reflected in `../requirements.md` — worth folding in during a future client sign-off pass, see `../requirements-conflicts.md`): the restaurant's internet connection is unreliable (beach location, weak WiFi), and the intent is **not** a purely local/offline system — there should be a central VPS as the long-term source of truth, with the local side tolerating connectivity loss rather than depending on it.

## The resulting shape: local-first, centrally synced

**One shared TypeScript backend codebase, deployed twice:**

1. **Local server** — runs on the restaurant's dedicated PC. SQLite database. This is what every device on-site (POS terminals, KDS, manager tablet) talks to over the LAN. It must keep working with zero internet.
2. **VPS server** — same codebase, PostgreSQL (hosted via Supabase, managed-Postgres-only — see stack table). The central, always-on store. The local server pushes to it in the background whenever connectivity is available; nothing time-critical on-site depends on it being reachable.

A local server without VPS sync is already a complete, useful system (this is why the phases below ship it before sync is built at all).

## Stack decisions

| Layer | Choice | Why (short version) |
|---|---|---|
| Language | TypeScript | Backend handles money/inventory/audit logic — compile-time safety pays for itself here. Fresh project, so no migration cost. |
| Backend framework | Fastify | Native TS support, built-in JSON-schema request validation. |
| Local database | SQLite | Embedded, zero-config, one file = trivial backup, fine for a single restaurant's LAN concurrency. |
| Central database | PostgreSQL, hosted via Supabase | Supabase used **only** for managed Postgres hosting (backups, connection pooling) — not its auto-API, Auth, or Realtime. Keeps business logic in our own code, not SQL policies. |
| ORM | Prisma | One schema, works against both SQLite and Postgres — keeps local/VPS structurally identical. |
| Real-time (LAN) | Socket.IO | Auto-reconnect matters given the connectivity theme; used only on the local server (live tables, KDS). |
| Local → VPS sync | Outbox table + periodic push job | Matches this scale (single restaurant, mostly single-writer-per-record data) without adding a message-broker service to install on-site. |
| API style | REST | Works for the Electron app, a future KDS tablet, or any future client without requiring the frontend to be TypeScript. |
| Auth | JWT | Verified locally with no network round-trip; same pattern extends to local→VPS service auth. |
| Local server deployment | Standalone background service (PM2/node-windows) | Matches §12's "dedicated PC is the server" framing — independent of any GUI window being open. |
| VPS architecture | Second Fastify instance, same codebase, in front of Postgres | Keeps the database off the public internet; gives a real place to add a remote dashboard later. |

## Alignment with the existing frontend — the core rule

`AppContext.jsx` already behaves like a backend client would want: one function per action (`addOrder`, `markPaid`, `cancelOrder`, `applyDiscount`, `createRecipe`, `approveRecipe`, `startShift`, `endShift`, `addTransaction`, ...), each permission-checked against the same `PERMISSIONS` table, each writing an audit-log entry in the same shape. Per the existing note in `../CLAUDE.md`, the plan was always "localStorage → `fetch()`" as a data-layer swap, not a redesign — and that swap is done (see Phase 1).

**Rule for every phase:** the backend's REST routes mirror `AppContext.jsx` function names 1:1, and these existing frontend files move to the backend close to verbatim (pure functions, zero React dependency):

- `frontend/src/config/permissions.js` — the permission matrix, enforced server-side now instead of only client-side.
- `frontend/src/utils/inventoryFlow.js` — recipe-driven stock deduction/restock, unit conversion.
- `frontend/src/utils/payroll.js`, `utils/accounting.js`, `utils/closing.js`, `utils/cost.js` — money/reporting math.

The Prisma schema (`backend/prisma/schema.prisma`) has grown beyond that original list as features were built — it now has 26 models, including ones no phase doc mentions: `MenuItemVariant` (per-item size/price variants), `PendingHandover`, `OutboxEntry` (Phase 4), `IngredientRequest`, `MostOrderedItem`, and `Sequence` (backs the human-readable `ORD-`/`TXN-` ids below). `Staff` also gained self-signup fields (`status`, `approvedBy`/`approvedAt`, `rejectedBy`/`rejectedAt`/`rejectReason`) — see [`07-post-phase1-features.md`](07-post-phase1-features.md).

The ID strategy question below was resolved in Phase 0 and hasn't changed since: `Order`/`Transaction` use a `cuid` as the real primary key (globally unique, safe for Phase 4 sync) plus a `Sequence`-table-backed integer (`core/ids.ts`'s `nextSequence()`) only for the human-display `ORD-1046`/`TXN-500` format. That integer field's `@unique` constraint was later dropped (Phase 4, see that doc) once it turned out to matter for cross-database sync — the `cuid` was always the only key that needed to be globally unique.

## Phase index

0. [Foundation](01-phase-0-foundation.md) — scaffolding, schema, ported business logic. No user-facing change. ✅ complete.
1. [Single-device backend](02-phase-1-single-device-backend.md) — replaces `localStorage`, one device, full feature parity. ✅ complete, manual QA done, frontend wired.
2. [Multi-device real-time (LAN)](03-phase-2-realtime-lan.md) — the actual "multiple cashiers/KDS see live data" requirement. ✅ built and verified.
3. [Local deployment hardening](04-phase-3-deployment-hardening.md) — background service, backups, device pairing. ✅ built and verified (bar a few reboot/real-LAN/USB checks that need the real hardware).
4. [VPS + sync](05-phase-4-vps-sync.md) — central store, offline-resilient sync. ✅ built; verified against both a local SQLite stand-in and (since, as production hardening) a real disposable Postgres engine. Still needs a real Supabase project to be fully proven.
5. [Cloud-facing features](06-phase-5-cloud-features.md) — only possible once Phase 4 exists. Not started — candidate list only, not yet scoped.
6. [Post-Phase-1 feature log](07-post-phase1-features.md) — real product features (self-signup/approval, recipe edit/delete, table shift, full business-day close, real menu seed) built after Phase 1 shipped, driven by direct client feedback (`../demand.md`) rather than the phase plan. Not numbered as a "phase" because it isn't backend-infrastructure work like 0–5 — it's ordinary feature development on top of an already-live Phase 1/2 system.

Each phase ships something usable on its own — stopping after Phase 1 or 2 is already a strict improvement over the original `localStorage`-only app, not a half-finished feature.

See also: [`99-future-considerations.md`](99-future-considerations.md) for ideas raised during planning that are **explicitly not scheduled work** (e.g. an MCP server) — kept separate so they don't get mistaken for committed scope; [`api-reference.md`](api-reference.md) for the full current route list; and [`frontend-architecture.md`](frontend-architecture.md) for the Electron/React side.
