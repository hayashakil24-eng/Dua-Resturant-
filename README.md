# Cafe Ali — Restaurant / Hotel Management System

An offline-first **Electron desktop app** for running a restaurant: POS / billing,
orders & tables, kitchen display (KDS) & recipes, inventory, staff & attendance,
accounting, cash-drawer reconciliation, online-payment accounts, GST, and an
end-of-day **Day Closing** report.

Built with **React + Vite + Tailwind CSS**, packaged as a Windows desktop app
with **Electron**. It currently runs on mock data (no backend yet) — all data
lives in the browser's `localStorage`, so it works fully offline.

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
cd "Dua-Resturant-/frontend"
```

> **Important:** all commands below run from inside the **`frontend/`** folder
> (the app lives there — there is no root `package.json`). Always `cd frontend`
> first.

---

## 3. Install dependencies

```bash
npm install
```

This downloads everything the app needs (React, Vite, Electron, Tailwind, …).
Run it once after cloning, and again whenever `package.json` changes.

---

## 4. Run the app

### A) Development mode (for testing / editing)

```bash
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

## 5. Logging in

This is a **demo build** with no real authentication:

1. On the login screen, pick a **role** — Admin, Manager, Cashier, or Kitchen.
2. Type **any password** (any text works).
3. Click **Sign in**.

Each role sees a different set of pages (see the role guide below).

| Role | Can access |
|------|-----------|
| **Admin** | Everything — reports, settings, closing, all money actions |
| **Manager** | Operations, staff, finance, day closing (view-level on some) |
| **Cashier** | POS / New Order, orders, billing, tables |
| **Kitchen** | Kitchen dashboard (create recipes) + Kitchen Display (KDS) |

---

## 6. About the data (zaroori baat)

- There is **no backend / database yet** — the app is fully offline and stores
  everything in the desktop app's local storage.
- Some data (orders, inventory, recipes, transactions, shifts, online accounts,
  saved closings…) **persists** across restarts.
- Some data (menu, tables, staff, attendance) is **seed/demo data** that resets
  on reload — this is intentional for the demo.
- **To reset all data:** clear the app's storage (in dev you can open DevTools →
  Application → Local Storage → clear; a fresh install starts clean).

---

## 7. Troubleshooting

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

## 8. Project layout

```
Dua-Resturant-/
├─ frontend/            ← the app (run all npm commands here)
│  ├─ electron/         ← Electron shell (main.js, preload)
│  ├─ src/              ← React app (pages, components, context, i18n)
│  │  ├─ pages/         ← POS, Orders, Reports, Closing, Settings, …
│  │  ├─ context/       ← AppContext.jsx (single global state, all logic)
│  │  ├─ config/        ← permissions.js, nav.js
│  │  └─ data/mockData.js  ← the seed "database"
│  └─ package.json      ← scripts & dependencies
├─ requirements.md      ← client requirements (Roman Urdu scope)
└─ README.md            ← this file
```

A future `backend/` will replace the mock-data layer; that's a swap inside
`AppContext.jsx` (localStorage → API calls) and doesn't affect the Electron shell.

---

## Quick start (Roman Urdu)

```bash
# 1. Repo clone karein
git clone https://github.com/hayashakil24-eng/Dua-Resturant-.git
cd "Dua-Resturant-/frontend"

# 2. Dependencies install karein (ek dafa)
npm install

# 3. App chalayein (desktop window khulegi)
npm run dev

# 4. Client ke PC ke liye Windows installer banayein
npm run dist      # → frontend/release/ mein .exe milega
```

Login: koi bhi role chunein (Admin/Manager/Cashier/Kitchen) + koi bhi password → Sign in.
