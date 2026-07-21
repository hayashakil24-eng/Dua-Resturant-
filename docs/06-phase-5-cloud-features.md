# Phase 5 — Cloud-Facing Features

Only possible once Phase 4 exists — these are the features that specifically need a central, always-on store rather than a single restaurant's local database.

## Goal

Capabilities that inherently require "reachable from anywhere," not just "reachable from the restaurant's LAN."

## Scope (candidates — not yet broken into sub-tasks)

- Remote owner/manager dashboard reading from the VPS — check sales, low stock, or staffing from off-site.
- Automated daily WhatsApp report (`../requirements.md` §6/§7) — note already flagged in `../requirements-conflicts.md` #2: an automated/system-initiated message carries a small ongoing per-message cost that an admin-initiated one doesn't; worth the client explicitly signing off on that before this ships.
- Cross-location reporting, if the business ever expands past one restaurant — the local-server-per-location + central-VPS shape from Phase 4 already supports this without redesign, this phase just builds the reporting UI for it.

## Frontend alignment

Likely a new, separate "remote dashboard" surface rather than a change to the existing Electron app — the existing app is explicitly the in-restaurant, LAN-connected client. Whether that's a small web app hitting the VPS API directly, or a mode within the existing Electron app, is a decision to make when this phase is actually scoped, not before.

## Done when

Not yet defined — this phase should be broken into its own scoped plan once Phase 4 is live and it's clear which of the candidate features are actually wanted first.
