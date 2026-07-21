# Cafe Ali — Restaurant / Hotel Management System

An offline-first **Electron desktop app** for running a restaurant: POS / billing,
orders & tables, kitchen display (KDS) & recipes, inventory, staff & attendance,
accounting, cash-drawer reconciliation, online-payment accounts, GST, and an
end-of-day **Day Closing** report.

Built with **React + Vite + Tailwind CSS**, packaged as a Windows desktop app
with **Electron**, backed by a **TypeScript/Fastify/Prisma** server (`backend/`)
that all devices on the restaurant's LAN talk to — real login, real persistence,
and live updates across devices (an order placed on one screen shows up on
another's within about a second). The backend must be running for the app to
work; see step 4 below.

---

## 1. Prerequisites (ye pehle install karein)

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | 18 LTS or newer (20 LTS recommended) | https://nodejs.org |
| **Git** | any recent version | https://git-scm.com |

- **Windows 10/11** is the target for the packaged app. Development also works on
  macOS/Linux, but the installer (`npm run dist`) produces a **Windows** build.
- Check your versions:
  ```bash
  node -v      # should print v18.x or higher
  npm -v
  git --version
  ```

---

## 2. Get the code (repo clone karein)

```bash
git clone https://github.com/hayashakil24-eng/Dua-Resturant-.git
cd Dua-Resturant-
```

> **Important:** there is no root `package.json` — `frontend/` and `backend/`
> are separate npm projects, each with their own commands below.

---

## 3. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

This downloads everything each side needs (Fastify/Prisma for the backend;
React, Vite, Electron, Tailwind for the frontend). Run it once after cloning,
and again whenever a `package.json` changes.

---

## 4. Run the backend (zaroori — pehle ye chalayein)

The frontend needs the backend running or it shows a "Cannot reach the
server" state.

```bash
cd backend
cp .env.example .env
npm run prisma:migrate   # applies migrations + seeds demo data (once)
npm run dev               # listens on :4000
```

Leave this running in its own terminal. See `backend/README.md` for the
backend's own run/test commands, `docs/` for the full architecture docs
(start at `docs/00-overview.md`), and the alternative `control-panel/` app
(a single Electron installer with no terminal/PM2 needed) that runs the
same backend.

---

## 5. Run the app

With the backend still running in its own terminal (step 4):

### A) Development mode (for testing / editing)

```bash
cd frontend
npm run dev
```

This opens the **Cafe Ali desktop window** (Electron), backed by the Vite dev
server on `http://localhost:5173`. Changes to the code hot-reload instantly.

### B) Build a Windows installer (for the client's PC)

```bash
npm run dist
```

This produces a **Windows installer (`.exe`)** in `frontend/release/`. Copy that
`.exe` to any Windows PC and run it to install Cafe Ali like a normal desktop
program — **no Node.js or terminal needed on that PC.**

### Other commands

| Command | What it does |
|---------|--------------|
| `npm run dev`     | Open the Electron app (development) |
| `npm run build`   | Production build → `dist/` (renderer) + `dist-electron/` |
| `npm run dist`    | Build **+ package** a Windows installer → `release/` |
| `npm run preview` | Preview the built renderer in a plain browser (rarely needed) |

---

## 6. Logging in

Real username/password login, backed by the database (`Staff.username` /
`passwordHash`, checked server-side):

1. On the login screen, enter a **username** and **password**.
2. Demo accounts seeded by `npm run prisma:migrate`: `admin`, `manager`,
   `cashier`, `kitchen` — all with password `1234`.
3. Click **Sign in**.

Each role sees a different set of pages (see the role guide below); the
backend independently re-checks every permission server-side, not just in
the UI.

New staff can also self-register from the login screen's "Sign up" link —
this creates a pending account with no access until an Admin approves it
(`/approvals` page) and assigns it a role. See
`docs/07-post-phase1-features.md` for the full approval flow.

| Role | Can access |
|------|-----------|
| **Admin** | Everything — reports, settings, closing, all money actions |
| **Manager** | Operations, staff, finance, day closing (view-level on some) |
| **Cashier** | POS / New Order, orders, billing, tables |
| **Kitchen** | Kitchen dashboard (create recipes) + Kitchen Display (KDS) |

---

## 7. About the data (zaroori baat)

- Data lives in the **backend's SQLite database** (`backend/prisma/dev.db`),
  not the browser — it survives closing the app, restarting the backend, or
  running a completely different device on the LAN.
- Multiple devices see the same data live: an order placed on one screen
  shows up on another's within about a second, no manual refresh (Socket.IO).
- Only the login JWT is kept in the frontend's `localStorage` — clearing it
  just logs you out, it doesn't touch any real data.
- One slice, `attendance`, is still frontend-local/seed-only for now (no
  real machine-attendance source exists yet) and resets on reload.
- **To reset all data:** stop the backend, delete `backend/prisma/dev.db`,
  and re-run `npm run prisma:migrate` to get a fresh seeded database.

---

## 8. Troubleshooting

**`npm run dev` crashes with**
`"The requested module 'electron' does not provide an export named 'BrowserWindow'"`

This is an **environment** issue, not a code bug. The `ELECTRON_RUN_AS_NODE`
environment variable is set, which makes Electron start in plain-Node mode. Unset
it and re-run:

```bash
# Windows (PowerShell)
Remove-Item Env:\ELECTRON_RUN_AS_NODE ; npm run dev

# Windows (CMD)
set ELECTRON_RUN_AS_NODE= && npm run dev

# macOS / Linux (bash)
unset ELECTRON_RUN_AS_NODE && npm run dev
```

**A blank/white window** on the packaged app → make sure you ran a full
`npm run build` (or `npm run dist`) so the `dist/` renderer exists.

**Port 5173 already in use** → close the other process using it, or stop any
previously running dev instance.

---

## 9. Project layout

```
Dua-Resturant-/
├─ frontend/            ← the Electron/React app
│  ├─ electron/         ← Electron shell (main.js, preload)
│  ├─ src/              ← React app (pages, components, context, i18n)
│  │  ├─ pages/         ← POS, Orders, Kitchen, KDS, Inventory, Reports, Closing, Settings, …
│  │  ├─ context/       ← AppContext.jsx (single global state, talks to the backend)
│  │  ├─ api/client.js  ← fetch wrapper + JWT storage
│  │  ├─ config/        ← permissions.js, nav.js
│  │  └─ data/mockData.js  ← seed reference only, no longer the live data source
│  └─ package.json      ← scripts & dependencies
├─ backend/             ← TypeScript/Fastify/Prisma server (see backend/README.md)
│  ├─ src/               ← core business logic, routes/services, realtime, sync, VPS instance
│  └─ prisma/            ← schema + migrations + seed
├─ control-panel/        ← alternative Electron app embedding the same backend (no PM2/terminal)
├─ docs/                 ← phase-by-phase architecture + build docs, start at docs/00-overview.md
├─ requirements.md      ← client requirements (Roman Urdu scope)
├─ requirements-conflicts.md ← open ambiguities needing client sign-off
├─ demand.md            ← running client feedback log (Roman Urdu)
└─ README.md            ← this file
```

---

## Quick start (Roman Urdu)

```bash
# 1. Repo clone karein
git clone https://github.com/hayashakil24-eng/Dua-Resturant-.git
cd Dua-Resturant-

# 2. Dependencies install karein (ek dafa) — backend aur frontend dono
cd backend && npm install && cd ../frontend && npm install && cd ..

# 3. Backend chalayein (alag terminal mein, isay chalta hi rehne dein)
cd backend
cp .env.example .env
npm run prisma:migrate
npm run dev

# 4. Frontend chalayein (naya terminal, desktop window khulegi)
cd frontend
npm run dev

# 5. Client ke PC ke liye Windows installer banayein
cd frontend
npm run dist      # → frontend/release/ mein .exe milega
```

Login: username + password daalein — demo accounts: `admin`/`manager`/`cashier`/`kitchen`, password `1234`.
