# API Reference

The full current REST route list, read directly off `backend/src/routes/*.ts` (not hand-maintained prose — regenerate this table from the route files if it ever drifts). **95 endpoints across 16 route files.** Base URL defaults to `http://localhost:4000`; the frontend's `src/api/client.js` talks to it (overridable via `VITE_API_URL`).

All routes except `/api/auth/login` and `/api/auth/signup` require a JWT (`Authorization: Bearer <token>`). "Any authenticated" below means any valid, non-`Pending` session — no specific permission needed (mostly GET routes multiple roles need to read, e.g. POS/KDS/Tables all reading orders). Everything else is gated by `requirePermission(key)` / `requireAnyPermission([...])` / `requireRole('Admin')` against `backend/src/core/permissions.ts` — the same table `frontend/src/config/permissions.js` mirrors, re-checked server-side independent of any UI gate (see `../CLAUDE.md`'s permissions section for why that's a hard rule in this codebase, not a nice-to-have).

## Auth (`auth.routes.ts`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/login` | none | Returns `{ token, user }`; `user.role` is `'Pending'` if the account hasn't been approved yet. |
| POST | `/api/auth/signup` | none | Self-signup, `{ name, username, password }` → `{ ok: true }`, no token. Creates a `Staff` row with `status: 'pending'`. |
| GET | `/api/auth/me` | JWT (pending allowed) | |
| POST | `/api/auth/logout` | JWT (pending allowed) | Revokes the caller's own session (`src/auth/sessions.ts`). |

## Orders (`orders.routes.ts`)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/orders` | any authenticated |
| GET | `/api/orders/:id` | any authenticated |
| POST | `/api/orders` | `pos` or `billing` |
| POST | `/api/orders/:id/items` | `pos`, `orders`, or `billing` |
| PATCH | `/api/orders/:id/items` | `pos`, `orders`, or `billing` |
| POST | `/api/orders/:id/table` | `pos`, `orders`, or `billing` — table shift, see `07-post-phase1-features.md` |
| POST | `/api/orders/:id/pay` | `orders` or `billing` |
| POST | `/api/orders/:id/cancel` | `orderCancel` |
| POST | `/api/orders/:id/discount` | `discount` |
| DELETE | `/api/orders/:id/discount` | `discount` |
| POST | `/api/orders/:id/udhaar` | `receivables` |
| POST | `/api/orders/:id/complimentary` | `orderComplimentary` |
| POST | `/api/orders/:id/ready` | `kds` |
| POST | `/api/orders/:id/served` | `kds` |

## Recipes & ingredient requests (`recipes.routes.ts`)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/recipes` | any authenticated |
| POST | `/api/recipes` | `recipeCreate` (Kitchen) |
| PATCH | `/api/recipes/:id` | `recipeCreate` (Kitchen) — resets to pending, see `07-post-phase1-features.md` |
| DELETE | `/api/recipes/:id` | Admin only |
| POST | `/api/recipes/:id/approve` | `recipeApproval` (Admin) |
| POST | `/api/recipes/:id/reject` | `recipeApproval` (Admin) |
| GET | `/api/ingredient-requests` | any authenticated |
| POST | `/api/ingredient-requests` | `recipeCreate` (Kitchen) |
| POST | `/api/ingredient-requests/:id/approve` | Admin only |
| POST | `/api/ingredient-requests/:id/reject` | Admin only |

## Inventory (`inventory.routes.ts`)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/inventory` | any authenticated |
| POST | `/api/inventory/:id/adjust` | `inventoryDirectEdit` or `inventoryAdd` |
| POST | `/api/inventory/:id/restock` | `inventoryAdd` or `inventoryDirectEdit` |
| POST | `/api/inventory` | `inventoryCreate` |

## Menu, categories & most-ordered (`menu.routes.ts`)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/menu` | any authenticated |
| POST | `/api/menu` | `menu` |
| PUT | `/api/menu` | `menu` — bulk replace |
| PATCH | `/api/menu/:id` | `menu` |
| DELETE | `/api/menu/:id` | `menu` |
| POST | `/api/menu/:id/toggle` | `menu` |
| GET | `/api/categories` | any authenticated |
| POST | `/api/categories` | `categoryAdd` |
| DELETE | `/api/categories/:name` | `categoryAdd` |
| GET | `/api/most-ordered` | any authenticated |
| POST | `/api/most-ordered/:menuItemId/toggle` | `mostOrderedManage` |

## Tables (`tables.routes.ts`)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/tables` | any authenticated |
| POST | `/api/tables` | `tableAdd` |
| PATCH | `/api/tables/:id` | `tableAdd` |
| DELETE | `/api/tables/:id` | Admin only |

## Staff & advances (`staff.routes.ts`)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/staff` | any authenticated |
| POST | `/api/staff` | `employees` |
| PATCH | `/api/staff/:id` | `employees` |
| DELETE | `/api/staff/:id` | Admin only |
| POST | `/api/staff/:id/toggle` | `employees` |
| GET | `/api/staff/pending-signups` | `staffApproval` (Admin) |
| POST | `/api/staff/:id/approve-signup` | `staffApproval` (Admin) |
| POST | `/api/staff/:id/reject-signup` | `staffApproval` (Admin) |
| GET | `/api/advances` | `payroll` |
| POST | `/api/advances` | `payroll` |
| DELETE | `/api/advances/:id` | `payroll` |
| POST | `/api/advances/recover` | `payroll` |

## Shifts & handovers (`shifts.routes.ts`)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/shifts` | any authenticated |
| GET | `/api/shifts/active` | any authenticated |
| GET | `/api/shifts/:id/sales` | any authenticated |
| GET | `/api/handovers` | any authenticated |
| POST | `/api/shifts/start` | `pos` or `billing` |
| POST | `/api/shifts/pause` | `pos` or `billing` |
| POST | `/api/shifts/resume` | `pos` or `billing` |
| POST | `/api/shifts/:id/end` | `pos` or `billing` |
| POST | `/api/handovers` | `pos` or `billing` |
| POST | `/api/handovers/:id/accept` | `handovers` |
| POST | `/api/handovers/:id/reject` | `handovers` |

## Receivables (`receivables.routes.ts`)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/receivables` | any authenticated |
| POST | `/api/receivables` | `receivables` |
| POST | `/api/receivables/:id/payment` | `receivables` |

## Departments (`departments.routes.ts`)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/departments` | any authenticated |
| POST | `/api/departments` | `departments` |
| DELETE | `/api/departments/:id` | `departments` |
| POST | `/api/departments/:id/items` | `departments` |
| DELETE | `/api/departments/:id/items/:itemId` | `departments` |

## Accounting (`accounting.routes.ts`)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/transactions` | `accounting` |
| POST | `/api/transactions` | `accounting` |
| DELETE | `/api/transactions/:id` | `accounting` |

## Settings & online accounts (`settings.routes.ts`)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/settings` | any authenticated |
| POST | `/api/settings/gst` | `settings` |
| POST | `/api/settings/gst-rate` | `settings` |
| GET | `/api/online-accounts` | any authenticated |
| POST | `/api/online-accounts` | `settings` |
| PATCH | `/api/online-accounts/:id` | `settings` |
| POST | `/api/online-accounts/:id/toggle` | `settings` |

## Closing (`closing.routes.ts`)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/closing/report` | `closing` |
| GET | `/api/closings` | `closing` |
| POST | `/api/closings` | `closing` — see `07-post-phase1-features.md` for preconditions/day-lock |

## Attendance (`attendance.routes.ts`)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/attendance` | `attendance` |
| POST | `/api/attendance/:staffId/override` | `attendanceOverride` |

## Misc

| Method | Path | Permission | File |
|---|---|---|---|
| GET | `/api/audit` | any authenticated | `audit.routes.ts` |
| GET | `/api/system/health` | `settings` (Admin) | `system.routes.ts` — uptime + last backup time |

VPS-side routes (`src/vps/`) are separate and not listed here — see `05-phase-4-vps-sync.md` (one generic `POST /api/sync/push`, service-JWT authenticated).

## Environment variables (`backend/src/env.ts`)

| Var | Default | Notes |
|---|---|---|
| `DATABASE_URL` | — | Read by Prisma directly, not `env.ts`. `file:./dev.db` locally. |
| `JWT_SECRET` | `dev-only-insecure-change-me` | Never hard-fails if unset — set a real one for anything beyond a dev sandbox. |
| `PORT` | `4000` | |
| `HOST` | `127.0.0.1` | Loopback-only by default; set `HOST=0.0.0.0` for LAN access (POS/KDS terminals, Control Panel). Only actually takes effect since the post-Phase-1 `.env`-loading fix — see `07-post-phase1-features.md`. |
| `BACKUP_DIR` | `backups` | Phase 3 local backup destination. |
| `BACKUP_HOUR` | `3` | 24h local time; checked every 15 minutes, not cron. |
| `VPS_URL` | `null` | Phase 4; unset = sync disabled. |
| `VPS_SYNC_SECRET` | `null` | Service-level JWT secret, deliberately distinct from `JWT_SECRET`. |
| `VPS_PORT` | `5000` | Port the separate `src/vps/server.ts` instance listens on. |
| `VPS_SYNC_INTERVAL_MS` | `30000` | |

`backend/.env.example` currently documents only `DATABASE_URL` — the rest of this table comes from reading `env.ts` directly, not from the example file.
