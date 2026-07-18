# Phase 0 — Foundation

**Status: ✅ complete.** No user-facing change. This phase builds the skeleton everything else sits on.

## What actually got built

- `backend/package.json`, `tsconfig.json`, `vitest.config.ts` — TypeScript workspace, Fastify + Prisma as dependencies (no routes written yet, per scope).
- `backend/prisma/schema.prisma` — full schema transcribing every `mockData.js`/`AppContext.jsx` shape (see file for the complete model list; the ID-strategy note below covers `Order.orderNumber`/`Transaction.txnNumber`).
- `backend/src/core/` — `permissions.ts`, `inventoryFlow.ts`, `orderTotal.ts`, `cost.ts`, `payroll.ts`, `accounting.ts`, `closing.ts`, `ids.ts` — all ported, all typed, all covered by tests.
- `backend/prisma/seed.ts` — seeds a representative, internally-consistent subset of the mock data (staff, all 302 tables, inventory, 11 menu items, departments, both seed recipes, orders, transactions) — this is what actually proved the schema was correct, beyond just "the migration applies."
- `backend/test/*.test.ts` — 39 tests across 7 files, including a fixture reproducing the exact recipe-deduction scenario (2× Chicken Shahi Karahi → 1 kg Chicken + 0.2 L Cooking Oil) that was verified live against the running frontend earlier, before this backend existed.

One real design decision made while implementing (not knowable purely from planning): SQLite only allows `autoincrement()` on the primary-key column itself, not on a secondary `@unique` field — hit this directly writing `orderNumber`/`txnNumber`. Resolved with a `Sequence` table + `core/ids.ts`'s `nextSequence()`, which increments atomically inside the caller's transaction — portable to Postgres unchanged, no provider-specific SQL. `Order`/`Transaction` keep a `cuid` as the actual primary key (globally unique, safe for Phase 4 sync) and the sequence-generated integer only as a human-display field.

## Goal

Have a backend workspace that runs, with a schema and ported business logic — but no real routes/features yet. "Does the skeleton exist and compile" is the bar, not "is it usable."

## Scope

- Set up the backend as a TypeScript workspace (Fastify + Prisma), structured as **one shared core service layer** with pluggable adapters. This matters from day one because Phase 2 adds a Socket.IO adapter and Phase 4 adds a second deployment target — if business logic lives inside route handlers instead of the core layer, both of those become rewrites instead of additions.
- Write the Prisma schema by transcribing `frontend/src/data/mockData.js`'s existing shapes — not a redesign:
  - `Order`, `OrderItem` (payment status, cancellation, discount, GST rate locked at creation, shiftId)
  - `InventoryItem`
  - `Recipe`, `RecipeIngredient` (status: pending/approved/rejected)
  - `Staff`
  - `Transaction` (accounting ledger)
  - `Receivable`, `ReceivableLedgerEntry` (unifies the frontend's separate `payments[]`/`charges[]` arrays into one dated ledger with a `type` discriminator)
  - `Department`
  - `OnlineAccount`
  - `ShiftReconciliation`, `PendingHandover`
  - `AuditLogEntry`
- Decide and implement the ID strategy (sequential server-side counters vs. UUIDs) — the frontend's current client-side `orderSeq`/`txnSeq` counters don't work once multiple devices write concurrently.
- Port these frontend files into the backend, adjusted only where they assumed in-memory arrays instead of a database:
  - `frontend/src/config/permissions.js` → the permission matrix, used to gate every route in Phase 1.
  - `frontend/src/utils/inventoryFlow.js` → `calculateDeductions`, `calculateRestocks`, `convertUnit`.
  - `frontend/src/utils/payroll.js`, `utils/accounting.js`, `utils/closing.js`, `utils/cost.js`.
- Basic environment/config setup (local `.env`, Prisma migration tooling) — no deployment automation yet, that's Phase 3.

## Frontend alignment

Nothing in `frontend/` changes in this phase. This is purely groundwork so Phase 1's routes have a schema and business logic to call.

## Done when

- ✅ `npx prisma migrate dev` runs cleanly against a local SQLite file (verified from a clean slate — deleted `dev.db` and re-ran end to end, migration + client generation + auto-seed all succeeded with no manual steps).
- ✅ The ported utility functions have at least a smoke test proving they still produce the same output as their frontend originals — 39 tests across 7 files, `npm test` all green, including the recipe-deduction fixture from the running frontend.
- ✅ No HTTP server, no auth, no real endpoints — `fastify` is a declared dependency (per scope) but nothing imports/starts it yet. That's Phase 1.

Next: [Phase 1 — Single-Device Backend](02-phase-1-single-device-backend.md).
