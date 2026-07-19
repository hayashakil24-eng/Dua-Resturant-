# Phase 1 — Single-Device Backend

**Status: ✅ complete, manual QA done.** The backend is complete (every `AppContext.jsx` mutator has a permission-gated, audited REST route; `npm test` → 56 green, 86 endpoints) **and the frontend is wired to it** — `AppContext.jsx` now hydrates from the backend and every mutator hits a route; `Login.jsx` does real username/password auth. A full manual QA pass drove every domain through the real running app (see "Manual QA findings" below) and found two real bugs, both now fixed. The `attendance` slice stays frontend-local for now (no real machine-attendance source exists yet); `overrideAttendance` already persists to the backend. See "Progress" at the bottom.

Replaces `localStorage` with the real local server. One device, no multi-device sync yet (that's Phase 2) — the milestone here is "durable, server-enforced data" not "multiple screens see the same thing live."

## Goal

Feature parity with today's app, but backed by SQLite through the Phase 0 schema instead of `localStorage`. Nothing new for the user to learn; everything that works today still works, just durably.

## Scope

- Build local Fastify REST endpoints mirroring every `AppContext.jsx` mutator **1:1 by name and behavior**:
  - Orders: `addOrder`, `appendOrderItems`, `markPaid`, `cancelOrder`, `updateOrderItemQty`, `applyDiscount`, `removeDiscount`, `markOrderUdhaar`, `markOrderComplimentary`
  - Kitchen: `markReady`, `clearKitchen`
  - Recipes: `createRecipe`, `approveRecipe`, `rejectRecipe`, `createIngredientRequest`, `approveIngredientRequest`, `rejectIngredientRequest`
  - Inventory: `adjustStock`, `restock`, `addInventoryItem`
  - Accounting: `addTransaction`, `deleteTransaction`
  - Tables: `addTable`, `updateTable`, `deleteTable`
  - Staff: `addStaff`, `updateStaff`, `deleteStaff`, `toggleStaff`
  - Advances: `addAdvance`, `deleteAdvance`, `recoverAdvances`
  - Menu: `addMenuItem`, `updateMenuItem`, `deleteMenuItem`, `toggleMenuItem`, `replaceMenu`, `addCategory`, `deleteCategory`
  - Shifts: `startShift`, `pauseShift`, `resumeShift`, `endShift`, `calculateShiftSales`
  - Handovers: `initiateHandover`, `acceptHandover`, `rejectHandover`
  - Receivables: `addReceivable`, `recordReceivablePayment`
  - Departments: `addDepartment`, `deleteDepartment`, `assignItemToDepartment`, `removeItemFromDepartment`
  - Settings: `setGst`, `setGstRate`, `addOnlineAccount`, `updateOnlineAccount`, `toggleOnlineAccount`
  - Closing: `saveDailyClosing`
  - Attendance: `overrideAttendance`
- Every route re-checks permissions server-side using the ported `permissions.js` — this is a strict improvement over today's frontend, where several mutators (documented and fixed in a prior pass: `markPaid`, `applyDiscount`, staff/menu/table mutators, etc.) only had a UI-level gate. The backend makes "context has no independent permission check" structurally impossible, not just fixed-for-now.
- Every mutating route writes an audit-log row in the same shape `AppContext.jsx` already produces (`{ id, action, ..., by, role, at }`).
- JWT auth: real staff login (username/PIN or username/password) replacing the current demo "pick a role, any password" `Login.jsx` flow.

## Frontend alignment

This is the phase where `AppContext.jsx` itself changes:

- State slices currently hydrated via `loadJSON(key, fallback)` from `localStorage` become `useState()` populated by a `fetch()` on mount.
- Every mutator function's body changes from a local `setX((prev) => ...)` call to an API request, then updates local state from the response (or from a refetch).
- `login`/`logout` change from setting local state to hitting the new auth endpoints and storing the JWT.
- **Every page and component is untouched** — they only ever call `useApp()`, never touch storage directly. This is the entire payoff of the existing architecture described in `../../CLAUDE.md`.
- `attendance`, `menu`, `tables`, `staff`, `advances`, `mostOrderedItemIds` currently reset to seed data every reload by design (not persisted) — once the backend is real, decide per-field whether that "resets on reload" behavior should become "resets on reload" (still fetched fresh, no caching) or become genuinely persisted. Likely the latter for all of these once there's a real database, since the original reason they weren't persisted was "no real persistence layer existed yet," not a product decision.

## Done when

- A single device can do everything today's app does — place orders, take payment, manage inventory/recipes/staff/tables, run shift reconciliation, view reports — against the local server instead of `localStorage`.
- Killing and restarting the local server (or the device) doesn't lose data.
- A permission-denied action is rejected server-side even if somehow triggered without the matching UI gate (test this directly against the API, not just through the UI).

## Progress

**Done:**
- HTTP + auth foundation: `src/app.ts` (Fastify assembly, error→HTTP mapping) + `src/server.ts` (listen); `@fastify/jwt` + `@fastify/cors` + `@fastify/sensible`; `src/env.ts` config; `src/auth/password.ts` (scrypt, no native dep); `src/auth/guard.ts` (`authenticate` / `requirePermission` / `requireAnyPermission` re-checking `core/permissions.ts` server-side); `src/lib/{errors,actor,audit}.ts`.
- Auth: `Staff` gained `username` / `passwordHash` / `systemRole` (migration `20260718120000_add_staff_auth`); seed adds demo logins **admin/manager/cashier/kitchen**, password `1234`. Routes `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.
- **Session registry** (added alongside the Control Panel's device-management feature, `src/auth/sessions.ts`): JWTs were originally fully stateless — valid forever on signature alone, with no server-side way to end one early. Login now also registers an in-memory session keyed by a `jti` in the token payload; `authenticate()` (REST) and the Socket.IO handshake (Phase 2) both reject a token whose `jti` isn't a currently-registered session. `POST /api/auth/logout` revokes the caller's own session; the Control Panel's "disconnect device" (`docs/04-phase-3-deployment-hardening.md`) revokes someone else's. **Consequence worth knowing**: since sessions are in-memory and not persisted, restarting the backend now requires every device to log in again — a behavior change from the previous fully-stateless JWTs. This is the correct trade-off for a revocation/"disconnect" feature to mean anything (a stateless token can't be un-issued), not a regression to chase down.
- Orders domain (`src/services/orders.service.ts` + `src/routes/orders.routes.ts`): `addOrder`, `appendOrderItems`, `markPaid`, `cancelOrder`, `updateOrderItemQty`, `applyDiscount`, `removeDiscount`, `markOrderUdhaar`, `markOrderComplimentary`, `markReady`, `clearKitchen`, plus list/get. Recipe-driven deduction/restock, shiftId attribution, GST-rate lock, and audit rows all inside Prisma transactions.
- Tests: `test/orders.api.test.ts` drives login → JWT → order placement → the known-good `2× Karahi → 1kg chicken + 0.2L oil` deduction, plus permission denials (Kitchen can't place, Cashier can't cancel, Admin can). `npm test` → 47 green. Server boot verified (`/api/health`, `/api/auth/login`).

- Inventory (`adjustStock`/`restock`/`addInventoryItem`) + recipes (`createRecipe`/`approveRecipe`/`rejectRecipe`) + ingredient requests (`create`/`approve`/`reject`) — `services/{inventory,recipes}.service.ts` + routes. Separation of duties enforced (Manager-only stock add, Admin-only recipe/request approval).
- Shifts (`startShift`/`pauseShift`/`resumeShift`/`endShift`/`calculateShiftSales`) + handovers (`initiate`/`accept`/`reject`) + receivables (`addReceivable`/`recordReceivablePayment`) — `services/{shifts,receivables}.service.ts` + routes. shiftId-attribution and accepted-handover-query model per schema.
- Config domains — `services/{menu,tables,staff,departments,accounting,settings,closing,attendance}.service.ts` + routes: menu/categories/mostOrdered, tables, staff+advances, departments (FK-based routing), accounting transactions (server-side txnNumber), settings (GST + online accounts), server-built daily closing, attendance override.
- Tests: `test/domains.api.test.ts` (9 tests) covers each domain's happy path, a permission denial, and the settings→order GST-lock. Total `npm test` → **56 green**.

- Frontend swap (task #6): `frontend/src/api/client.js` (fetch wrapper + JWT storage); `AppContext.jsx` rewritten to hydrate every slice from the backend on mount and `await` a REST call + refetch in each mutator (pure/derived helpers kept local; `attendance` stays a local mock); `Login.jsx` now real username/password. Added a read-only `GET /api/audit` (Orders page consumes the audit trail). Orders/transactions normalized on fetch to keep human ids (`ORD-…`/`TXN-…`) in the UI while mutators use the server cuid. Ten page call-sites that read a mutator result synchronously were made `async`/`await`; all other pages/components untouched. Verified: `frontend` prod build green, all 20 boot endpoints return 200 for Admin (403-tolerant for restricted roles), CORS allows GET/POST/PUT/PATCH/DELETE.

## Manual QA findings

A full manual pass (real backend + Vite dev server, driven headlessly through the actual UI, not just the automated suite) exercised every domain: auth/login for all 4 roles, order placement with recipe-driven inventory deduction, discount apply/remove, order cancellation, kitchen routing + KDS mark-ready/served, shift start/end reconciliation, partial handover initiate/accept, recipe approval, inventory restock, staff/menu/table/category CRUD, attendance override, daily closing, and reports — plus server-side permission denial checks and a backend restart to confirm persistence. Two real bugs turned up and were fixed:

1. **Demo logins didn't work at all.** The `20260718120000_add_staff_auth` migration had never been applied to the local `dev.db`, so `prisma.staff.findUnique` crashed on `username` not existing. Fixed by running `prisma migrate deploy` + re-seeding. Anyone else's local `dev.db` predating that migration will hit the same thing — worth a note in onboarding/setup docs.
2. **Systemic: ~19 no-payload actions returned 500.** `frontend/src/api/client.js` always sent `Content-Type: application/json`, even with no body; Fastify rejects a truly empty body under that header (`FST_ERR_CTP_EMPTY_JSON_BODY`), surfaced as a bare 500. This silently broke `markReady`, `markOrderServed`, `removeDiscount`, `approveRecipe`, `pauseShift`, `resumeShift`, `acceptHandover`, `toggleStaff`, `toggleMenuItem`, `toggleMostOrdered`, `toggleOnlineAccount`, and every `delete*` mutator. Fixed with a one-line change (commit `8dc69dc`): only attach the `Content-Type` header when a body is actually sent. Verified via real UI clicks (not just curl) after the fix — zero 500s across the rest of the QA pass.

**Remaining (non-blocking):** none identified this pass. Future work should still spot-check `replaceMenu`, `rejectRecipe`/`rejectIngredientRequest`, `rejectHandover`, and `recordReceivablePayment`, which weren't explicitly exercised.
