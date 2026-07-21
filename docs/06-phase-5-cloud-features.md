# Phase 5 — Cloud-Facing Features

Only possible once Phase 4 exists — these are the features that specifically need a central, always-on store rather than a single restaurant's local database.

Note: Phase 4's VPS/Postgres path was since hardened for production (see `05-phase-4-vps-sync.md`'s "Production hardening" section and `deployment-setup.md`'s "VPS server deployment") — a real, disposable Postgres engine now verifies the migration + sync path end to end, not just a SQLite stand-in. That removes an infrastructure blocker for this phase, but none of the candidate features below were built as part of that work — this phase is still unscoped.

## Goal

Capabilities that inherently require "reachable from anywhere," not just "reachable from the restaurant's LAN."

## Scope (candidates — not yet broken into sub-tasks)

- ~~Automated daily WhatsApp report~~ — **built**, not just a candidate anymore. See "WhatsApp Cloud API integration" below.
- Remote owner/manager dashboard reading from the VPS — check sales, low stock, or staffing from off-site.
- Cross-location reporting, if the business ever expands past one restaurant — the local-server-per-location + central-VPS shape from Phase 4 already supports this without redesign, this phase just builds the reporting UI for it.

## WhatsApp Cloud API integration (built)

Implements `../requirements.md` §6/§7 in full — both halves:

- **Automated**: `backend/src/whatsapp/schedule.ts`, a local-server job (same
  pattern as `backup/schedule.ts`) that sends the most recently *saved*
  DailyClosing once a day, at an admin-configurable hour (Settings page).
  The per-message cost this carries was flagged in
  `../requirements-conflicts.md` #2 before this was built — now live with a
  real Meta test-mode number, not yet through Meta's business verification
  (see `deployment-setup.md`'s WhatsApp section) — get that sign-off, and go
  through verification, before this reaches real customers.
- **On-demand**: `backend/src/whatsapp/webhook.ts`, registered on the VPS
  (`src/vps/app.ts`) — the admin messages the system directly and gets the
  latest report back, free within Meta's service-conversation window per
  §7. Needed the VPS specifically because Meta requires a publicly-trusted
  TLS cert on a fixed port, which only became possible once the self-signed
  cert from `05-phase-4-vps-sync.md` was replaced with a real one via
  sslip.io + Let's Encrypt (`deployment-setup.md`).
- **Rendering**: `backend/src/reports/whatsappReport.ts` — the report is a
  branded PNG (bilingual Urdu/English), matching the client's own manual
  WhatsApp-shared report format, not a plain-text message. Uses headless
  Chromium (Puppeteer) specifically for correct Urdu/Nastaliq text shaping,
  with the font bundled and inlined so it works fully offline.
- Closed two sync gaps this surfaced: `DailyClosing` wasn't synced to the
  VPS at all before this (needed — it's the data the webhook replies with).

## Frontend alignment

Likely a new, separate "remote dashboard" surface rather than a change to the existing Electron app — the existing app is explicitly the in-restaurant, LAN-connected client. Whether that's a small web app hitting the VPS API directly, or a mode within the existing Electron app, is a decision to make when this phase is actually scoped, not before.

## Done when

Not yet defined — this phase should be broken into its own scoped plan once Phase 4 is live and it's clear which of the candidate features are actually wanted first.
