# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Cafe Ali — Restaurant/Hotel Management System.** This is a monorepo-in-progress: `frontend/` holds the React + Vite + Tailwind CSS app, packaged as an **Electron desktop app** (per `requirements.md` §11 — offline-first desktop, not web-based); a `backend/` directory will be added later. The frontend currently runs on mock data — no backend, no API. All "persistence" is `localStorage`; all "database" is `frontend/src/data/mockData.js`. When the backend exists, that's purely a data-layer swap in `AppContext.jsx` (localStorage → `fetch()` calls) — it doesn't touch the Electron shell. See `requirements.md` for the full client requirements doc (Roman Urdu original scope) and `requirements-conflicts.md` for open ambiguities that still need client sign-off before they're built.

All commands below and all file paths in this document are relative to `frontend/` unless stated otherwise — `cd frontend` first.

## Commands

```bash
cd frontend
npm install
npm run dev      # opens the Electron app (dev), backed by the Vite dev server on :5173
npm run build    # production build → dist/ (renderer) + dist-electron/ (main/preload)
npm run dist     # build + package a Windows installer → release/
npm run preview  # preview the built renderer in a plain browser (rarely needed — use `dev` or `dist`)
```

There is no lint, format, or test tooling configured in the frontend (no ESLint/Prettier config, no test runner, no `test` script). Don't assume `npm test` or `npm run lint` exist — verify changes by running the dev server.

### Electron shell

`electron/main.js` and `electron/preload.js` are the desktop shell around the unmodified React renderer (`src/`) — added via `vite-plugin-electron` (see `vite.config.js`), not a restructure into `src/renderer`. Key points:
- **Dev**: the `BrowserWindow` loads `http://localhost:5173` directly.
- **Packaged**: it loads via `electron-serve`, which serves the built `dist/` over a custom `app://` scheme with SPA fallback. This is required (not optional) because `mockData.js` has ~70 menu items with **absolute** image paths (`/Pina Colada.jfif`) that would 404 under a raw `file://` load, and because `react-router-dom`'s `BrowserRouter` (unchanged, still used) needs server-like fallback-to-`index.html` behavior for deep-link routes to survive a reload. Don't "simplify" this to `win.loadFile()` — it will break both.
- `contextIsolation: true` / `nodeIntegration: false` / `sandbox: true` throughout; `preload.js` is currently just a stub (`window.electron.platform`) — extend it via `contextBridge`, never by flipping `nodeIntegration` on.
- External links (e.g. the WhatsApp share in `Reports.jsx`, `window.open('https://wa.me/...')`) are intercepted in `main.js` via `setWindowOpenHandler` and sent to the system browser via `shell.openExternal` — without this they'd open in a bare chromeless Electron window.
- `preload.js` builds to `dist-electron/preload.mjs` (CJS content, `.mjs` extension) because `package.json` has `"type": "module"` — this is `vite-plugin-electron`'s documented, correct output for that config, not a bug; `main.js` references that exact filename.

## Architecture

### Single global state tree, no backend

`src/context/AppContext.jsx` is the entire application: one `AppProvider` holds every domain's state (orders, inventory, recipes, staff, accounting transactions, shift reconciliation, receivables, departments, ...) and exposes all mutation functions through one `useApp()` hook. There is no per-domain store, no Redux, no server round-trip — a page component calls `useApp()` and gets both the data and the actions to mutate it directly.

When adding a feature, the pattern is always: add state to `AppProvider`, add a mutation function next to the state (permission-checked at the top via `canModify`), add it to the `value` object at the bottom, and add an audit-log entry (see below). Don't invent a second state container.

### Selective localStorage persistence

Only state that must survive a reload for correctness is persisted (`orders`, `inventory`, `recipes`, `transactions`, `receivables`, `departments`, `shiftReconciliations`, `activeShift`, `pendingHandovers`, plus the `orderSeq`/`txnSeq` id counters). Each persisted slice has its own `useEffect` writing to a specific `localStorage` key, and is hydrated via the `loadJSON(key, fallback)` helper at the top of `AppProvider`. `attendance`, `menu`, `tables`, `staff`, `advances`, and `mostOrderedItemIds` are **not** persisted and reset to seed data (`mockData.js`) on every reload — this is intentional, not a bug, unless a task says otherwise. If you add new mutable state that needs to survive a reload, follow the existing `loadJSON` + dedicated `useEffect` pattern rather than a generic "persist everything" approach.

### Role-based access: `permissions.js` is the single source of truth

`src/config/permissions.js` defines a `PERMISSIONS` table per role (`Admin`, `Manager`, `Kitchen`, `Cashier`) with per-feature access levels (`'full' | 'edit' | 'create' | 'view' | 'none' | 'hidden'`). Three helpers read it:
- `hasAccess(role, pageKey)` — gates route/page visibility (`src/config/nav.js` filters the sidebar with this; `App.jsx`'s `Protected` wrapper redirects if a route isn't allowed).
- `canModify(role, pageKey)` — gates whether a UI control renders/an action is allowed (`'full'`, `'edit'`, `'create'` all count as modify-capable).
- `getAccessLevel(role, pageKey)` — raw level lookup for finer-grained UI (e.g. `'view'` vs `'edit'`).

Every state-mutating function in `AppContext.jsx` re-checks `canModify(user.role, ...)` **inside the function itself**, not just in the UI — treat the UI check and the context-level check as two independent gates and always add both when adding a permission-sensitive action. The permissions file's own comments document several intentional **separation-of-duties splits** (e.g. only Admin approves recipes even though Kitchen creates them; only Manager adds new inventory stock even though Admin can correct existing quantities) — these splits are deliberate anti-collusion controls, not oversights, so don't "simplify" them into one role having both powers.

### Audit trail convention

Almost every mutating action in `AppContext.jsx` appends an entry to `auditLog` (`{ id: 'AUD-...', action, ..., by, role, at }`) right after the state change. When adding a new mutation that changes money, inventory, orders, or staff records, add a matching audit entry in the same style — this is how the app satisfies the "no silent deletes, full audit trail" requirement from `requirements.md` §8.

### Orders never get hard-deleted

Orders are only ever transitioned between states (`Unpaid → Paid`, `→ Cancelled`, `→ Udhaar` (on-account credit), `→ Complimentary` (free/comped)) via `cancelOrder`, `markOrderUdhaar`, `markOrderComplimentary`, etc. — never removed from the `orders` array. Cancellation requires a `reason` and is gated behind `orderCancel` permission; complimentary requires `orderComplimentary` permission plus an authorizer name. Follow this pattern for any new order-status feature instead of deleting/mutating in place.

### Inventory auto-deduction is recipe-driven

Stock isn't tied to menu items directly — it flows through `recipes` (`menuItemId → [{ inventoryItemId, quantity, unit }]`, status `pending|approved|rejected`). `deductInventoryForOrder` (called from `addOrder` and `appendOrderItems`) and `restockInventoryForOrder` (called from `cancelOrder`) both go through `src/utils/inventoryFlow.js`'s `calculateDeductions`/`calculateRestocks`, which only act on menu items that have an **approved** recipe — items without one are silently skipped so the POS keeps working before a recipe exists. Unit conversion between a recipe's unit and the inventory item's stored unit goes through `convertUnit`/`CONVERSIONS` in the same file; if you need a new unit pair, add it there rather than converting inline.

### Department-based kitchen order routing

`departments` map menu item ids to a named counter/station (e.g. Grill, Bar, Bakery); `getDepartmentForItem(itemId)` resolves an order line to its department by stripping any `::variant` suffix from the cart key first. Assigning an item to a department **moves** it — it's removed from every other department first, so an item always routes to exactly one KOT/counter. This routing is what drives `KitchenSlips.jsx` / `KOTView.jsx` printing per-counter tickets instead of one monolithic kitchen ticket.

### Printing: multiple scoped print surfaces, one at a time

`src/utils/print.js`'s `safePrint(bodyClass)` is the only way to trigger `window.print()` — it debounces rapid double-clicks (1.5s) and adds a `print-<surface>` class to `<body>` so `src/index.css`'s `@media print` rules can reveal only one `#printable-*` element at a time (`#printable-receipt`, `#printable-report`, `#printable-kots`, `#printable-daily`). Before adding a new printable view, add its own `#printable-x` id + a matching `body.print-x` CSS block rather than reusing an existing surface — reusing one caused the KOT/receipt overlap bug fixed in a recent commit.

### i18n: lightweight custom implementation, not react-i18next

`src/i18n/LanguageContext.jsx` implements `t('a.b.c')` by dot-path lookup into `en.json`/`ur.json`, falling back English → key itself, so untranslated strings degrade gracefully instead of crashing. Language is persisted to `localStorage('lang')` **synchronously** (not just via effect) because `src/utils/format.js`'s `money`/`time`/`dateShort`/etc. read `localStorage` directly (not the React context) so they stay correct in the same render as a language toggle. Urdu mode also flips `dir="rtl"` on `<html>` and switches number formatting to Eastern-Arabic digits (`ur-PK-u-nu-arabext` locale) — when adding new number/date formatting, follow the existing pattern in `format.js` rather than calling `toLocaleString` ad hoc, or it'll render Latin digits in Urdu mode.

### Cash drawer / shift reconciliation

`activeShift` represents one cashier's open drawer (`startShift` → `pauseShift`/`resumeShift` → `endShift`). Sales are attributed to a shift via `order.shiftId` (stamped at `addOrder`/`markPaid` time), **not** by timestamp — this is deliberate so seed/demo orders and other shifts' orders never leak into a drawer's expected-cash calculation (`shiftSalesForShift`/`calculateShiftSales`). Mid-shift partial handovers (`initiateHandover` → `acceptHandover`/`rejectHandover`) require a Manager/Admin to accept before the cash actually leaves the drawer total. If you touch this flow, preserve the shiftId-attribution pattern rather than filtering orders by time window.

### Routing / role landing pages

`App.jsx`'s `Protected` wrapper redirects to the first nav item a role has access to (`navForRole(role)[0]`) rather than a hardcoded home route — so a role with a restricted nav (e.g. `Kitchen`, whose only visible page is `/kitchen`) still lands somewhere valid. `/kds` (Kitchen Display) renders `fullscreen` (no sidebar/header `Layout`) since it's meant to run unattended on a kitchen monitor.

## Conventions to follow

- Commit messages use `type(scope): summary` (e.g. `feat(billing):`, `fix(print):`, `fix(cash):`) — match this style.
- Money is always integer Rupees via `money()` in `format.js`; don't hardcode a currency symbol or call `toLocaleString` directly on an amount.
- Comments in this codebase are used specifically to explain *why* a non-obvious decision was made (e.g. why a field isn't persisted, why an attribution uses `shiftId` instead of timestamp) — match that style if you leave a comment; don't add comments describing what code obviously does.
