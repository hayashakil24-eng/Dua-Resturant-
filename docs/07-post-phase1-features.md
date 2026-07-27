# Post-Phase-1 Feature Log

Phases 0–4 (see `00-overview.md`'s phase index) were the backend build-out. Once Phase 1/2 were live, work shifted to ordinary product features driven by direct client feedback (`../demand.md`) and follow-on requests — not backend infrastructure, so they don't get a phase number, but they touched both backend and frontend and aren't described anywhere else. This doc exists so they're not undocumented.

## Staff self-signup + admin approval

Previously, every staff account was created directly by an Admin (`addStaff`). Now a new person can request an account themselves, and an Admin approves or rejects the request before it's usable.

**Endpoints** (`backend/src/routes/auth.routes.ts`, `backend/src/routes/staff.routes.ts`):

| Method & path | Auth | Body | Response |
|---|---|---|---|
| `POST /api/auth/signup` | none (public) | `{ name, username, password }` | `{ ok: true }` — no token issued |
| `POST /api/auth/login` | none | `{ username, password }` | `{ token, user }` — `user.role` is `'Pending'` if not yet approved |
| `GET /api/auth/me` | JWT, `authenticateAllowPending` | — | `{ user }` |
| `GET /api/staff/pending-signups` | Admin only (`staffApproval` permission) | — | `{ pendingSignups: Staff[] }`, oldest first |
| `POST /api/staff/:id/approve-signup` | Admin only | `{ systemRole }` (`Admin`\|`Manager`\|`Cashier`\|`Kitchen`) | `{ staff }` |
| `POST /api/staff/:id/reject-signup` | Admin only | `{ reason? }` | `{ staff }` |

**State machine** — `Staff.status` (`prisma/schema.prisma`): `"pending" | "approved" | "rejected"`, default `"approved"` (so every pre-existing/admin-created row is unaffected). A self-signup row starts `status: "pending"`, `role: "Pending"`, `systemRole: null`. Approval sets `systemRole` + `status: "approved"` + `approvedBy`/`approvedAt`. Rejection sets `status: "rejected"` + `rejectedBy`/`rejectedAt`/`rejectReason`.

**Login before approval works, access doesn't**: `authenticateCredentials` (`src/services/auth.service.ts`) checks the password first, then branches on `status` — `"rejected"` → 403 `"Your signup request was not approved."`; `"pending"` → login succeeds and issues a JWT with `role: 'Pending'` (no error). `guard.ts`'s normal `authenticate()` then rejects any `'Pending'`-role session on every real route with 403 `"Your account is pending admin approval."`; only `authenticateAllowPending` (used by `/api/auth/me` and `/api/auth/logout`) lets a pending session through at all. `PERMISSIONS.Pending` in `core/permissions.ts` also hides every page/action, so this is enforced the normal two-gate way (server + `permissions.js`), not a special-cased bypass.

**Audit log**: `STAFF_SIGNUP_REQUESTED` (actor is a synthetic `{ role: 'Pending' }` built from the new row), `STAFF_SIGNUP_APPROVED`, `STAFF_SIGNUP_REJECTED` (actor is the approving/rejecting Admin).

**Frontend**: `Signup.jsx` (public `/signup` form) → `PendingApproval.jsx` (`/pending-approval` waiting room, `App.jsx`'s `Protected` wrapper redirects a `'Pending'`-role session here, logout-only) → `Approvals.jsx` (Admin-only `/approvals` page, nav key `staffApproval`, lists `pendingSignups` and lets the Admin pick a role and approve/reject).

## Recipe edit/delete + ingredient unit picker

Recipes previously could only be created and approved/rejected, never edited or removed.

**New endpoints** (`backend/src/routes/recipes.routes.ts`):

| Method | Path | Permission |
|---|---|---|
| `PATCH` | `/api/recipes/:id` | `recipeCreate` (Kitchen only) |
| `DELETE` | `/api/recipes/:id` | Admin only |

Service functions: `updateRecipe(ctx, recipeId, { ingredients })`, `deleteRecipe(ctx, recipeId, reason = '')` (`recipes.service.ts`).

**Editing resets approval**: `updateRecipe` unconditionally sets `status: 'pending'` and clears `approvedBy`/`approvedAt`/`rejectedBy`/`rejectedAt`/`rejectReason` — an approved recipe can be edited, but any edit forces it back through Admin approval again (same separation-of-duties rule as creation, see `CLAUDE.md`'s permissions section). Ingredient rows are wholesale replaced (delete-all, recreate), not diffed. `deleteRecipe` is unconditional/Admin-only regardless of status, hard-deletes the row (ingredients cascade via FK), and records the caller's `reason` in the audit entry. New audit actions: `RECIPE_UPDATED`, `RECIPE_DELETED` (alongside the existing `RECIPE_SUBMITTED`/`RECIPE_APPROVED`/`RECIPE_REJECTED`).

**Ingredient unit picker** (`frontend/src/components/RecipeFormModal.jsx`): each ingredient row gets a `<select>` of units scoped to the linked inventory item's base measure — `weight` items offer `kg/g/tbsp/tsp/cup`, `volume` items offer `L/ml/tbsp/tsp/cup`; count-based items (pcs/packs) get one locked, disabled option. The choices are constrained to whatever `convertUnit()` (`frontend/src/utils/inventoryFlow.js`, mirrored in the backend's `core/inventoryFlow.ts`) actually knows how to convert back to the item's stored unit — this commit also added the tablespoon/teaspoon-to-ml/L conversions needed to support the new picker options.

## Full business-day close

`demand.md` item 9: closing should warn before resetting, block if any bill is still pending, require the cash drawer to be closed first, and afterward the live dashboard/closing figures should start fresh for a new "session" — without deleting anything.

There's no per-day status flag or "day" row that gets reset. The business-day boundary is a single **timestamp**: `getBoundaryIso()` (`backend/src/services/closing.service.ts`) returns the `closingTime` of the most-recently-created `DailyClosing` row (or `null` before the first-ever closing). That value flows into `buildClosingReport(..., sinceIso)` (`backend/src/core/closing.ts`), where `inSession(d)` treats anything created after `sinceIso` as belonging to the open session (falls back to whole-calendar-day scoping if `sinceIso` is `null`). The frontend (`frontend/src/utils/closing.js`, `Closing.jsx`) mirrors this exactly via `lastClosingAt`.

**Preconditions**, both checked inside `saveDailyClosing` (server-side, in addition to the UI disabling the button for the same reasons):

- `assertNoActiveShift()` — any `ShiftReconciliation` row `status in ('active', 'paused')` → 409 `"A cash drawer is still open — end the shift (reconcile the drawer) before closing the day."`
- `assertNoPendingOrders(sinceIso)` — any `Order` in the current session with `payment: 'Unpaid', cancelled: false` → 409 `"${n} bill(s) are still unpaid — mark each as Udhaar or Complimentary before closing."`
- `assertHasActivity(report)` — the **day-lock**: if the current session has zero orders and zero expenses → 409 `"Nothing new to close — this session has no sales since the last closing."` Since the session boundary only advances when a new `DailyClosing` row is created, and that row can only be created when the session has activity, re-closing is structurally blocked until a new sale or expense lands after the last close.

**"Reset" is not deletion.** Saving a closing does exactly one write: a new `DailyClosing` row (`date`, `closedBy`, `closedByRole`, `closingTime`, `totalSales`, `reportJson` — the full frozen report as JSON) plus a `DAY_CLOSED` audit entry. Every order, transaction, and prior `DailyClosing` row is untouched — `listClosings()` reads the full history back with each report intact. The live dashboard/closing preview only *look* reset because the newest `closingTime` becomes the new `sinceIso`, and there's no activity after it yet.

## Cash handover chain

Cash moves **Cashier → Manager/Admin → Admin**, so a day's takings end in one pair of hands.

**Only the addressed role may sign for cash.** Both Admin and Manager hold the `handovers` permission, so approval used to be whoever clicked first — a cashier could hand cash to the Admin and a Manager would accept it, leaving the accepted record naming the wrong holder. `assertAddressedTo` (`backend/src/services/shifts.service.ts`) now requires `handover.toRole === actor.role` on both accept and reject; `PendingHandoversPanel` / `HandoverApprovals.jsx` filter the pending list by the same rule (UI gate + server gate, per CLAUDE.md). The Processed tab stays unfiltered — it's read-only history and hiding half of it would work against the audit trail.

**A handover can only be addressed to Admin or Manager** (`assertReceivable`). This closed a live bug: `ShiftEndModal`'s "Other" option sent the literal string `'Other'` as the role, which no one matches — harmless while anyone could approve, but it would have stranded the cash permanently once approval became role-bound. The modal now sends the chosen person's `systemRole` and only lists Admin/Manager staff. Note `Staff.role` is a **job title** and `Staff.systemRole` is the permission role; the handover path uses `systemRole || role` everywhere, because only the latter is what the approval gate compares against.

**Manager → Admin** is `POST /api/handovers/forward` (`handoverForward` permission, Manager-only — Admin is the final destination and has nowhere to forward to). That leg has no drawer behind it, so `PendingHandover.shiftId` is nullable and the amount is capped by what the manager is actually still holding, not by a drawer balance. It is `kind: 'forward'` so `computeSales`' `kind: 'mid_shift'` filter never deducts it from anyone's shift.

**Running a drawer is its own permission (`drawer`), not implied by `pos`/`billing`.** A Manager can punch orders and settle bills (`pos: 'full'`, `billing: 'create'`), but must never start/end a shift or initiate the cashier-side handover — they are the one who *receives* handovers, and someone who both hands cash over and signs for it defeats the whole chain. `shifts.routes.ts` previously guarded the drawer with `requireAnyPermission(['pos', 'billing'])`, which would have handed a Manager drawer control the moment they were given the POS; the dedicated key keeps the two apart. Admin and Cashier hold `drawer: 'full'`, everyone else `'none'`.

**Cash positions are confidential up the chain.** A Manager must not be able to read what the Admin — or another manager — is holding. Two gates: `CashOnHandPanel` shows a non-Admin only their own position (no per-role tiles, no overall total, and the "by cashier" list limited to legs they personally signed for — the total and that list would otherwise give away the hidden figures by subtraction); and `GET /api/handovers` scopes its own response, since filtering only in the UI would still ship the amounts to the device. Admin gets every row, Manager gets pending Manager-addressed rows plus what they resolved or initiated, Cashier gets only their own handovers (which is exactly what `Layout.jsx`'s "waiting for approval" badge needs). The Approvals page's Processed tab therefore needs no filter of its own.

**"Cash on hand", not "total received."** Summing every accepted handover double-counts the middle leg — a manager's Rs.5,000 counted once when the cashier gave it up and again when the admin received it. `cashPositions()` (`frontend/src/utils/cashFlow.js`, mirroring `cashHeldBy()` server-side) instead reports who is holding what: credited to `resolvedBy` (whoever actually accepted it — a shift-end handover is addressed to the role string and only names a person at acceptance), debited from `fromName`/`fromRole` when they forward it on. `fromRole` is null on rows predating this, all cashier-initiated, so there is nothing to net out. Scoped to the open business session, like every other dashboard money figure.

## Reports scoped by session, not calendar day

The Reports page used to filter on `toDayStr(o.createdAt) === dailyDate`, which was the one surface that had never adopted the session boundary above. Because a real session routinely runs 2pm→3pm the *next* day, that split one business day's figures across two calendar dates and the earlier half looked lost. Reports is now scoped to the same closing-to-closing window as `Closing.jsx` and the Dashboard.

**Sessions are derived, not stored.** A `DailyClosing` row records only its end (`closingTime`); nothing links an order to a closing. Since `listClosings()` returns rows newest-first, session N's start is row N+1's `closingTime` — derived server-side into `periodStart`/`periodEnd` on each record, and re-derived client-side by `buildSessions()` (`frontend/src/utils/sessions.js`) so the page works before a refetch lands. The interval is half-open, `(from, to]`, matching `inSession`'s `> sinceMs`, so a session report and the closing sheet agree to the rupee. A session with no predecessor (the oldest row, or before the first-ever closing) keeps calendar-day scoping — that is the semantics its report was actually built with, so reproducing it is correct, not a gap to fix.

`buildClosingReport` now returns `periodStart`/`periodEnd` too, and `saveDailyClosing` stamps `periodEnd` with `closingTime` before freezing `reportJson` — so a reprinted sheet and the WhatsApp PNG state the window they cover instead of a single date. Closings saved before this existed have neither field; every consumer falls back to the date-only header (`normalizeReport()` in `src/whatsapp/report.ts` backfills both to `null`).

UI: the Reports period toggle is **Session | Monthly** (the calendar-date picker is gone), the session `<select>` lists the open session plus every past one by its window, and a **History** tab (`frontend/src/components/SessionHistory.jsx`) lists closed sessions — `[View]` re-derives the full report for that window from live orders, `[Print sheet]` reprints the frozen snapshot through the existing `print-closing` surface. Range labels are rendered inside `dir="ltr"` because the `→` is direction-neutral and would otherwise swap ends in Urdu.

## Table shift for running orders

Moves an in-progress (unpaid, uncancelled) order to a different table.

- `POST /api/orders/:id/table`, body `{ table: number|string }`, gated behind the same permission as other running-order edits (`pos`/`orders`/`billing`).
- Service: `shiftOrderTable(ctx, orderId, newTable)` (`backend/src/services/orders.service.ts`). Rejects a cancelled or already-paid order ("Only a running (unpaid) order can be moved to another table"), a no-op move to the same table, a nonexistent destination table, and **a destination that already holds a running order** — two unpaid bills on one seat is a billing mix-up, not a merge. `ShiftTableModal.jsx` renders those tables greyed-out/unclickable with an "in use" tag, but the server check is the real gate (two cashiers can pick the same free table at the same moment). Covered by `backend/test/domains.api.test.ts`'s "table shift" case.
- Only the `table` column changes — order items, kitchen status (`OrderItem.kitchen`), and payment state are untouched, so KOT routing/kitchen tickets are unaffected by a table shift.
- Audit action `ORDER_TABLE_SHIFTED` (`details: { orderId, from, to }`), broadcast over the same outbox/realtime path as other order mutations (Phase 2/4).

## Real menu seed with images + variant handling

`fd545f4` replaced the placeholder ~11-item seed menu with the actual Café Ali menu (with image paths) and added a `MenuItemVariant` model (per-item size/price variants, e.g. small/large) that didn't exist in the original Phase 0 schema — see `backend/prisma/schema.prisma`'s `MenuItemVariant` model and `backend/prisma/seed.ts`'s "Seeding MenuItem (real Café Ali menu — full)" step.

## `env.ts` — `.env` actually gets loaded now

`backend/src/env.ts` previously read `process.env` directly for everything except `DATABASE_URL` (which Prisma loads itself) — so setting `HOST=0.0.0.0` in `backend/.env` to allow LAN access was silently ignored, since nothing ever loaded that file into `process.env` for the rest of the app to see. `env.ts` now calls `process.loadEnvFile?.()` (Node ≥20.12) at module load, wrapped in try/catch so a missing `.env` (vitest, or the Control Panel importing this module from its own working directory) doesn't throw. The default host binding is still `127.0.0.1` (loopback-only) — this fix makes an explicit `HOST=0.0.0.0` in `.env` actually take effect, it doesn't change the default. See `deployment-setup.md` and `../control-panel/README.md` for why LAN binding matters for a real on-site deployment.

Note: `backend/.env.example` currently documents only `DATABASE_URL` — it doesn't list `HOST`, `PORT`, `JWT_SECRET`, or the `VPS_*` vars that `env.ts` actually reads (see `api-reference.md`'s "Environment variables" section for the full list). Worth fixing the example file in a future pass so a fresh clone doesn't have to read source to discover them.
