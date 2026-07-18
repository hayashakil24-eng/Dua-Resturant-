# Backend

**Phase 0 (foundation) is complete.** No HTTP server yet, no routes, nothing the frontend talks to — that's Phase 1. What exists right now is the TypeScript workspace, the Prisma schema (SQLite locally), and the ported core business logic, all covered by tests. The frontend (`../frontend/`) still runs entirely on mock data / `localStorage` — this backend isn't wired to it yet.

Start here: [`docs/00-overview.md`](docs/00-overview.md) for the architecture and stack decisions, then the numbered phase files for the build order and status of each.

## Running this locally

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:migrate   # applies migrations + auto-runs prisma/seed.ts
npm test                 # 39 tests, core/ business logic + a real-DB sequence check
npm run build             # tsc, no emit errors expected
```

Next up: [Phase 1 — Single-Device Backend](docs/02-phase-1-single-device-backend.md).
