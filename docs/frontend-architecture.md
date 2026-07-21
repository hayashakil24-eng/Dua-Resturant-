# Frontend Architecture

This is a directory/page inventory and a pointer doc — the actual architectural rules (single global state tree, permission gating, audit trail convention, inventory auto-deduction, printing surfaces, i18n, cash-drawer/shift attribution, routing) are documented in **`../CLAUDE.md`** and deliberately not duplicated here; that file is the one kept current turn-by-turn as the canonical reference for how the frontend is built. This doc is the map — what exists and where — cross-referencing `CLAUDE.md` for the *why*.

React + Vite + Tailwind CSS, packaged as a Windows desktop app with Electron. Talks to the backend (`../backend/`) over REST + Socket.IO — see `00-overview.md` and `../CLAUDE.md`'s "Data layer" section for that history (it used to be `localStorage`-only; that's gone).

## Pages (`frontend/src/pages/`)

| Page | Purpose |
|---|---|
| `Login.jsx` | Real username/password login. |
| `Signup.jsx` | Public self-signup form — see `07-post-phase1-features.md`. |
| `PendingApproval.jsx` | Waiting room for a `'Pending'`-role session (redirected here by `App.jsx`'s `Protected` wrapper). |
| `Approvals.jsx` | Admin-only: approve/reject pending staff signups. |
| `Dashboard.jsx` | Live sales/stats overview. |
| `POS.jsx` | New-order entry / billing screen. |
| `Orders.jsx` | Running + historical orders, cancel/discount/udhaar/complimentary actions, audit trail view. |
| `Tables.jsx` | Live table grid — status, table shift, table management (add/rename). |
| `Billing.jsx` | Payment / receipt flow for an order. |
| `Kitchen.jsx` | Kitchen dashboard — recipe creation, ingredient requests. |
| `KitchenDisplay.jsx` | `/kds` — fullscreen (no `Layout` sidebar/header), meant to run unattended on a kitchen monitor. |
| `MenuManagement.jsx` | Menu items, categories, variants (`MenuItemVariant`), most-ordered curation. |
| `Inventory.jsx` | Stock levels, restock, direct adjustment. |
| `DepartmentManagement.jsx` | Maps menu items to kitchen counters/departments (KOT routing). |
| `Employees.jsx` | Staff CRUD, advances. |
| `Attendance.jsx` | Attendance records + manual override (`overrideAttendance` — the one slice that stays frontend-local/mock, see `02-phase-1-single-device-backend.md`). |
| `Payroll.jsx` | Payroll calculation off attendance + advances. |
| `Accounting.jsx` | Transaction ledger (income/expense), category breakdowns. |
| `ReceivablesManagement.jsx` | Udhaar (on-account credit) tracking, per-account ledger breakdown, settle payments. |
| `HandoverApprovals.jsx` | Manager/Admin accept/reject a cashier's mid-shift partial handover. |
| `Closing.jsx` | Full Business-Day Close — see `07-post-phase1-features.md` for the precondition/reset/day-lock behavior this page drives. |
| `Reports.jsx` | Daily/monthly reports, WhatsApp share. |
| `Settings.jsx` | Admin-only: GST, online payment accounts, server health card (Phase 3/4 status). |

## Key components (`frontend/src/components/`)

Print surfaces (`KOTView.jsx`, `KitchenSlips.jsx`, `ClosingSlip.jsx`, `DailyClosingView.jsx`, `DailyReportSlip.jsx`) each own their own `#printable-*` id — see `../CLAUDE.md`'s printing section before adding a new one. Modals follow a `*Modal.jsx` naming convention (`PaymentModal`, `DiscountModal`, `MarkAsUdhaarModal`, `MarkAsComplimentaryModal`, `ShiftStartModal`/`ShiftEndModal`, `PartialHandoverModal`, `HandoverApprovalModal`, `RecipeFormModal`, `SettleReceivableModal`, `ManualOverrideModal`, `ItemAssignmentModal`, `ShiftTableModal`, `AutoResumeModal`, `ManageMostOrderedModal`). `RecipeStatusBadge.jsx` and `ComplimentaryOrderDetail.jsx` are small presentational pieces; `Layout.jsx` is the sidebar/header shell every non-fullscreen page renders inside.

## State, API, config

- `context/AppContext.jsx` — the single global state tree (see `../CLAUDE.md`). Hydrates from the backend on mount, opens the Socket.IO connection, holds every mutator.
- `api/client.js` — `fetch()` wrapper, JWT storage (`localStorage('token')` — the *only* thing still in `localStorage`), `discoverAndSetBase()` (LAN auto-discovery, see `04-phase-3-deployment-hardening.md`).
- `config/permissions.js` — the `PERMISSIONS` table, mirrored server-side by `backend/src/core/permissions.ts`. Single source of truth for role access — see `../CLAUDE.md`.
- `config/nav.js` — sidebar nav definition, filtered per-role via `hasAccess()`.
- `utils/` — pure/derived helpers: `format.js` (money/date/i18n-aware number formatting — read this before adding any new formatted number), `inventoryFlow.js`, `closing.js`, `accounting.js`, `cost.js`, `payroll.js`, `attendanceHelpers.js`, `print.js` (`safePrint()`, the only way to trigger `window.print()`).
- `i18n/` — `LanguageContext.jsx` (dot-path `t('a.b.c')` lookup, not react-i18next), `en.json`/`ur.json`.
- `data/mockData.js` — seed reference only; not the live data source since Phase 1.
- `hooks/useEscapeKey.js` — the one custom hook in the app.

## Electron shell (`frontend/electron/`)

`main.js` + `preload.js` — see `../CLAUDE.md`'s "Electron shell" section for the dev-vs-packaged loading split (`electron-serve` + `app://`, not `win.loadFile()`), `contextIsolation`/`sandbox` posture, external-link handling, and the `dist-electron/preload.mjs` build quirk. `main.js`'s `discover-server` IPC handler (raw UDP via `dgram`, can't run in the renderer) backs `api/client.js`'s `discoverAndSetBase()` — see `04-phase-3-deployment-hardening.md`.

## Alternative deployment: Control Panel

`../control-panel/` is a separate Electron app (own `src/`, own `package.json`) that embeds `@cafe-ali/backend` in-process instead of the frontend talking to a standalone server — see `../control-panel/README.md` and `04-phase-3-deployment-hardening.md`. It is not part of `frontend/`; it's a different on-site install option for the same backend.

## Commands

```bash
cd frontend
npm install
npm run dev      # Electron app (dev), Vite dev server on :5173
npm run build    # dist/ (renderer) + dist-electron/ (main/preload)
npm run dist     # vite build && electron-builder → frontend/release/*.exe
npm run preview  # preview built renderer in a plain browser (rarely needed)
```

No lint/format/test tooling is configured (`../CLAUDE.md` — verify changes by running the dev server, not `npm test`/`npm run lint`, which don't exist).
