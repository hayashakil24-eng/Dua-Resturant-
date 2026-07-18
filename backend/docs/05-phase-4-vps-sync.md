# Phase 4 — VPS + Sync

Adds the central, always-on store. Genuinely additive — the local server (Phases 1–3) keeps working exactly as before if the VPS is unreachable, which is the entire point given the restaurant's unreliable internet.

## Goal

Everything that happens locally eventually lands in one central Postgres database, without day-to-day operations ever waiting on that to happen.

## Scope

- Stand up the second Fastify instance on the VPS — same core service layer from Phase 0, pointed at PostgreSQL (hosted via Supabase, managed-Postgres-only, per `00-overview.md`) instead of SQLite. No Socket.IO/local real-time layer needed here; that's a LAN concern.
- Add an outbox table locally: every write that matters (new order, payment, stock adjustment, etc.) also logs a row marked "pending sync."
- Background job on the local server: check for connectivity periodically, and when available, push pending outbox rows to the VPS API, marking them synced on success.
- Retry/backoff handling for failed pushes (connectivity can flap, not just drop cleanly) — doesn't need to be a full message queue (deliberately not chosen, see `00-overview.md`), but does need to not silently drop a row after one failed attempt.
- JWT service-level credential for the local server to authenticate to the VPS API, distinct from individual staff sessions.

## Frontend alignment

None directly — the frontend keeps talking only to the local server, exactly as in Phases 1–2. Sync is entirely a local-server-to-VPS concern; the Electron app doesn't need to know the VPS exists. The one exception: Phase 3's "server health" surface in `Settings.jsx` gets a new field (last successful sync time) once this phase exists.

## Done when

- Data written locally while offline shows up in the VPS Postgres database within one sync interval after connectivity returns, with no manual intervention.
- Killing connectivity mid-sync doesn't duplicate or lose records — a retried push is safe to repeat.
- The local server's day-to-day behavior (Phases 1–2) is provably unaffected by the VPS being down for an extended period.
