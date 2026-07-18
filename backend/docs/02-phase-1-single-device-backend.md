# Phase 1 — Single-Device Backend

**Status: 🚧 in progress.** The entire backend is built — every `AppContext.jsx` mutator now has a permission-gated, audited REST route, all tested against the running server (`npm test` → 56 green, 85 endpoints). The **only** remaining Phase 1 work is the frontend swap (`AppContext.jsx` `localStorage` → `fetch()`). See "Progress" at the bottom.

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
- Auth: `Staff` gained `username` / `passwordHash` / `systemRole` (migration `20260718120000_add_staff_auth`); seed adds demo logins **admin/manager/cashier/kitchen**, password `1234`. Routes `POST /api/auth/login`, `GET /api/auth/me`.
- Orders domain (`src/services/orders.service.ts` + `src/routes/orders.routes.ts`): `addOrder`, `appendOrderItems`, `markPaid`, `cancelOrder`, `updateOrderItemQty`, `applyDiscount`, `removeDiscount`, `markOrderUdhaar`, `markOrderComplimentary`, `markReady`, `clearKitchen`, plus list/get. Recipe-driven deduction/restock, shiftId attribution, GST-rate lock, and audit rows all inside Prisma transactions.
- Tests: `test/orders.api.test.ts` drives login → JWT → order placement → the known-good `2× Karahi → 1kg chicken + 0.2L oil` deduction, plus permission denials (Kitchen can't place, Cashier can't cancel, Admin can). `npm test` → 47 green. Server boot verified (`/api/health`, `/api/auth/login`).

- Inventory (`adjustStock`/`restock`/`addInventoryItem`) + recipes (`createRecipe`/`approveRecipe`/`rejectRecipe`) + ingredient requests (`create`/`approve`/`reject`) — `services/{inventory,recipes}.service.ts` + routes. Separation of duties enforced (Manager-only stock add, Admin-only recipe/request approval).
- Shifts (`startShift`/`pauseShift`/`resumeShift`/`endShift`/`calculateShiftSales`) + handovers (`initiate`/`accept`/`reject`) + receivables (`addReceivable`/`recordReceivablePayment`) — `services/{shifts,receivables}.service.ts` + routes. shiftId-attribution and accepted-handover-query model per schema.
- Config domains — `services/{menu,tables,staff,departments,accounting,settings,closing,attendance}.service.ts` + routes: menu/categories/mostOrdered, tables, staff+advances, departments (FK-based routing), accounting transactions (server-side txnNumber), settings (GST + online accounts), server-built daily closing, attendance override.
- Tests: `test/domains.api.test.ts` (9 tests) covers each domain's happy path, a permission denial, and the settings→order GST-lock. Total `npm test` → **56 green**.

**Remaining:**
- Frontend swap: rewrite `AppContext.jsx` (`localStorage` → `fetch()`) + real login in `Login.jsx`. Pages/components untouched. This is the last Phase 1 step (task #6).
