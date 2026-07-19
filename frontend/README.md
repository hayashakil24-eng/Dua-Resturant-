# Cafe Ali — Management System (Frontend)

A premium, luxury-themed restaurant management frontend for **Cafe Ali**.
Built with **React + Vite + Tailwind CSS**, packaged as an Electron desktop
app. Talks to the `../backend/` Fastify/Prisma server over REST + Socket.IO —
see the root `../README.md` and `../CLAUDE.md` for how the two fit together.
This README covers the frontend on its own; the backend must be running
(`cd ../backend && npm run dev`) or the app shows a "Cannot reach the server"
state.

## Palette & Design
- Background: black `#0B0B0D`
- Accent: gold `#C9A227` (with `#E0C463` / `#8C6F1A` gradient)
- Text: cream `#F5EFE0`
- Serif display font (Cormorant Garamond) for headings, Inter for body
- Fully responsive: desktop / tablet / mobile

## Roles & Access

Role-based sidebar, gated by `src/config/permissions.js` (`hasAccess`/`canModify`/`getAccessLevel`) both client-side and — independently — on every backend route:

| Role | Can access |
|------|-----------|
| **Admin** | Everything — reports, settings, closing, staff, recipe/request approval, all money actions |
| **Manager** | Operations, staff, finance, day closing, inventory restock (view-level on some Admin-only actions) |
| **Cashier** | POS / New Order, orders, billing, tables |
| **Kitchen** | Kitchen dashboard (create recipes) + Kitchen Display (KDS) only |

## Pages (`src/pages/`)

`Login`, `Dashboard`, `POS`, `Orders`, `Kitchen`, `KitchenDisplay` (`/kds`, fullscreen), `Tables`, `Inventory`, `MenuManagement`, `DepartmentManagement`, `Employees`, `Attendance`, `Payroll`, `Billing`, `Accounting`, `ReceivablesManagement`, `HandoverApprovals`, `Closing`, `Reports`, `Settings`.

## Run

```bash
npm install
npm run dev      # opens the Electron app (dev), Vite dev server on http://localhost:5173
npm run build    # production build → dist/ (renderer) + dist-electron/ (main/preload)
npm run dist     # build + package a Windows installer → release/
npm run preview  # preview the built renderer in a plain browser (rarely needed)
```

There is no lint, format, or test tooling configured here (no ESLint/Prettier
config, no test runner) — verify changes by running the dev server.

## Logging in

Real username/password auth (`POST /api/auth/login` → JWT, stored in
`localStorage`). Demo accounts seeded by the backend: `admin` / `manager` /
`cashier` / `kitchen`, password `1234`.

## Structure
```
src/
  context/AppContext.jsx   # single global state — hydrates from the backend on mount,
                            # every mutator posts to a permission-gated route then refetches
  api/client.js             # fetch wrapper + JWT storage (only thing left in localStorage)
  data/mockData.js          # seed reference only, no longer the live data source
  config/                   # permissions.js, nav.js
  components/                # Layout, Logo, Icons, shared UI
  pages/                      # see "Pages" above
  i18n/                        # LanguageContext.jsx — custom en/ur dot-path translation
```

> Data lives in the backend's database, not the browser — it survives a
> restart and is shared live across every device on the LAN (Socket.IO). Only
> the JWT and the UI language preference are kept in `localStorage`. One
> slice, `attendance`, is still frontend-local/seed-only for now since no real
> machine-attendance source exists yet.
