# Docs

Architecture and build documentation for Cafe Ali. Was `backend/docs/`; moved to the repo root because it now covers the frontend and control-panel too, not just the backend.

Start here: [`00-overview.md`](00-overview.md) — why there's a backend at all, the stack decisions, and the phase index.

## Backend build history (phase docs)

Chronological, each one done before the next started:

0. [`01-phase-0-foundation.md`](01-phase-0-foundation.md) — schema + ported business logic, no user-facing change.
1. [`02-phase-1-single-device-backend.md`](02-phase-1-single-device-backend.md) — replaced `localStorage`, full REST API, frontend wired.
2. [`03-phase-2-realtime-lan.md`](03-phase-2-realtime-lan.md) — Socket.IO, multi-device live updates.
3. [`04-phase-3-deployment-hardening.md`](04-phase-3-deployment-hardening.md) — PM2 service, LAN discovery, local backups.
4. [`05-phase-4-vps-sync.md`](05-phase-4-vps-sync.md) — central VPS store, outbox-pattern sync.
5. [`06-phase-5-cloud-features.md`](06-phase-5-cloud-features.md) — not started; candidate list only.

Each phase doc has its own status line — check it before assuming something is or isn't built.

## Reference (kept current, not chronological)

- [`api-reference.md`](api-reference.md) — every REST route, permission required, and the env vars `backend/src/env.ts` reads. Regenerate from the route files if it drifts; don't hand-guess.
- [`frontend-architecture.md`](frontend-architecture.md) — page/component inventory for `frontend/`, pointing back to `../CLAUDE.md` for the architectural rules themselves.
- [`07-post-phase1-features.md`](07-post-phase1-features.md) — real features built after Phase 1/2 shipped (self-signup/approval, recipe edit/delete, table shift, full business-day close) that don't belong to any phase doc above.
- [`99-future-considerations.md`](99-future-considerations.md) — ideas raised during planning that are **explicitly not scheduled work** (e.g. an MCP server).
- [`deployment-setup.md`](deployment-setup.md) — one-time on-site PM2 setup steps for the standalone backend deployment (the Control Panel, `../control-panel/`, is the alternative to this — see its own README).

## Elsewhere in the repo

- [`../README.md`](../README.md) — clone/install/run instructions for the whole project.
- [`../CLAUDE.md`](../CLAUDE.md) — the canonical architecture/conventions reference (single global state tree, permission gating, audit trail, printing, i18n — the rules, not just the inventory).
- [`../backend/README.md`](../backend/README.md) — backend-specific run/test commands.
- [`../control-panel/README.md`](../control-panel/README.md) — the alternative single-Electron-app on-site deployment.
- [`../requirements.md`](../requirements.md) — original client requirements (Roman Urdu).
- [`../requirements-conflicts.md`](../requirements-conflicts.md) — open ambiguities still needing client sign-off.
- [`../demand.md`](../demand.md) — a running client feedback log (Roman Urdu); several items there map directly to [`07-post-phase1-features.md`](07-post-phase1-features.md).
