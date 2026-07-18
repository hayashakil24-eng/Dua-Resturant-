# Phase 3 — Local Deployment Hardening

Makes the local server survive real-world restaurant conditions without a technical person on-site babysitting it. No new features for staff — this phase is about the server being trustworthy, not about doing more.

## Goal

The "dedicated PC" from `requirements.md` §12 behaves like a real server: always on, restarts itself if it crashes, and its data is backed up daily without anyone remembering to do it manually.

## Scope

- Package the local Fastify server as a standalone background service (PM2 or `node-windows`) — auto-starts on boot, auto-restarts on crash. Matches §12's framing of a dedicated PC that *is* the server, independent of whether any Electron client window happens to be open on it.
- Device pairing/discovery on the LAN, so a new POS terminal or KDS screen can find the server PC without a staff member typing an IP address by hand (relevant to §13's on-site install process, which assumes non-technical setup).
- Local backup job: the SQLite database file copied to an external drive/USB on a schedule, satisfying §12's "automatic daily backups" requirement — this is separate from and simpler than the VPS sync built in Phase 4 (a local safety net, not the central store).
- Basic operational visibility: is the local server up, when did it last back up, when did it last successfully sync to the VPS (once Phase 4 exists) — doesn't need to be fancy, just answerable without SSH-ing into the machine.

## Frontend alignment

Minimal — mostly a settings/admin-panel surface to show server health (last backup time, sync status) rather than a change to existing pages. Could reasonably live in `Settings.jsx`, which is already the Admin-only configuration page.

## Done when

- The server PC can be rebooted and the backend comes back up on its own, with all connected devices reconnecting automatically (leaning on Phase 2's Socket.IO reconnect behavior).
- A backup file from the previous day exists on the external drive without anyone having triggered it manually.
- A new device can join the LAN and start talking to the server without manual IP configuration.
