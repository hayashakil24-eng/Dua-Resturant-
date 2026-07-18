# Phase 2 — Multi-Device Real-Time (LAN)

This is the phase that actually satisfies `requirements.md` §9 ("visible in real time to all cashiers") and §10 (kitchen display updates in real time). Phase 1 alone is single-device; this is what makes multiple devices share one live picture.

## Goal

An order placed on one device appears instantly — table status, KDS, a second cashier's screen — on every other device on the LAN, with no manual refresh.

## Scope

- Add Socket.IO to the local server (Phase 0's "pluggable adapter" architecture pays off here — this is a new adapter on the existing core service layer, not a rewrite of it).
- Broadcast events on the same actions that already write audit-log entries — the audit log is already the natural list of "things worth broadcasting" (order placed, item marked ready, table status changed, discount applied, shift started/ended, handover initiated).
- Scope broadcasts sensibly (e.g. Socket.IO "rooms") so a KDS screen isn't receiving accounting events it doesn't care about.
- Frontend: `AppContext.jsx` subscribes to these events and merges them into state, so state updates arrive both from the device's own actions (as in Phase 1) and from other devices' actions (new in this phase).

## Frontend alignment

- New: a Socket.IO client connection managed alongside the existing `useApp()` provider — likely a `useEffect` in `AppProvider` that subscribes on mount and dispatches into the same `setX()` calls Phase 1 already wired up to API responses. The mutators themselves don't change again; only the "how does state also update when *another* device did something" path is new.
- `getDepartmentForItem` (already department-aware in the frontend, per `../../CLAUDE.md`'s KOT-routing section) starts mattering for real here — routing a live order to the correct kitchen counter's screen, not just computing it for a print layout.
- `KitchenDisplay.jsx` (`/kds`, fullscreen) and `Tables.jsx`'s live table grid are the two screens this phase is really for — worth using them as the acceptance test.

## Done when

- Two devices open side by side: placing an order on one visibly updates the other's table view and the KDS within roughly a second, with no manual refresh anywhere.
- A brief WiFi drop on one device (simulating the beach-WiFi scenario) doesn't corrupt state — Socket.IO's reconnect brings it back in sync, it doesn't need an app restart.
