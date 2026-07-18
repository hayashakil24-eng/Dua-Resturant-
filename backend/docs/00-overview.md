# Backend Architecture Overview

Status: **planning only** — no backend code exists yet. This document and the phase files beside it are the agreed plan; implementation starts at [Phase 0](01-phase-0-foundation.md).

## Why a backend at all

`requirements.md` §11–§12 describe an offline-first desktop app backed by a dedicated local PC "server," with real-time state shared across multiple cashiers (§9) and a kitchen display (§10). `localStorage` (the frontend's current persistence) is per-device and cannot satisfy either of those — this is the reason a backend is needed, not a rewrite for its own sake.

Additional context gathered during planning (not yet reflected in `requirements.md` — worth folding in during a future client sign-off pass, see `../../requirements-conflicts.md`): the restaurant's internet connection is unreliable (beach location, weak WiFi), and the intent is **not** a purely local/offline system — there should be a central VPS as the long-term source of truth, with the local side tolerating connectivity loss rather than depending on it.

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

`AppContext.jsx` already behaves like a backend client would want: one function per action (`addOrder`, `markPaid`, `cancelOrder`, `applyDiscount`, `createRecipe`, `approveRecipe`, `startShift`, `endShift`, `addTransaction`, ...), each permission-checked against the same `PERMISSIONS` table, each writing an audit-log entry in the same shape. Per the existing note in `../CLAUDE.md`, the plan was always "localStorage → `fetch()`" as a data-layer swap, not a redesign.

**Rule for every phase:** the backend's REST routes mirror `AppContext.jsx` function names 1:1, and these existing frontend files move to the backend close to verbatim (pure functions, zero React dependency):

- `frontend/src/config/permissions.js` — the permission matrix, enforced server-side now instead of only client-side.
- `frontend/src/utils/inventoryFlow.js` — recipe-driven stock deduction/restock, unit conversion.
- `frontend/src/utils/payroll.js`, `utils/accounting.js`, `utils/closing.js`, `utils/cost.js` — money/reporting math.

The Prisma schema mirrors `frontend/src/data/mockData.js`'s existing shapes (`Order`, `OrderItem`, `InventoryItem`, `Recipe`, `Staff`, `Transaction`, `Receivable`, `Department`, `OnlineAccount`, `ShiftReconciliation`, `AuditLogEntry`) rather than being redesigned from scratch.

One open decision carried into Phase 0: the frontend currently mints sequential IDs (`ORD-1046`, `TXN-500`) client-side via `orderSeq`/`txnSeq` counters in `AppContext.jsx`. That doesn't work once multiple devices write concurrently — needs a server-side sequence or a switch to UUIDs, decided when Phase 0 writes the schema.

## Phase index

0. [Foundation](01-phase-0-foundation.md) — scaffolding, schema, ported business logic. No user-facing change.
1. [Single-device backend](02-phase-1-single-device-backend.md) — replaces `localStorage`, one device, full feature parity.
2. [Multi-device real-time (LAN)](03-phase-2-realtime-lan.md) — the actual "multiple cashiers/KDS see live data" requirement.
3. [Local deployment hardening](04-phase-3-deployment-hardening.md) — background service, backups, device pairing.
4. [VPS + sync](05-phase-4-vps-sync.md) — central store, offline-resilient sync.
5. [Cloud-facing features](06-phase-5-cloud-features.md) — only possible once Phase 4 exists.

Each phase ships something usable on its own — stopping after Phase 1 or 2 is already a strict improvement over today's `localStorage`-only app, not a half-finished feature.

See also: [`99-future-considerations.md`](99-future-considerations.md) for ideas raised during planning that are **explicitly not scheduled work** (e.g. an MCP server) — kept separate so they don't get mistaken for committed scope.
