# Phase 1 — Single-Device Backend

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
