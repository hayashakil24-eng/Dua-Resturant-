# Future Considerations — Explicitly NOT Scheduled Work

Ideas raised during architecture planning that influenced *how* the backend is structured, but are **not committed phases**. Kept separate from the phase index on purpose, so they don't get mistaken for scope anyone has signed off on.

## AI-native / MCP server

Raised as a "what if, someday" during planning — not a requirement, not a phase. The only thing this actually changed in the current plan is a structural preference already reflected in Phase 0: keep business logic in one core service layer with thin adapters on top (REST, Socket.IO), rather than logic baked directly into route handlers. If an MCP server is ever wanted, it would be one more thin adapter on that same core layer — most likely living on the VPS, since that's where centralized data would be. It is **not scheduled**, has no phase number, and shouldn't be built speculatively.

If this ever becomes real work, two things flagged during planning should carry over:
- The agent should have its own role/permission identity in the same `permissions.js` table as Admin/Manager/Cashier/Kitchen — not a special bypass.
- AI-initiated audit-log entries should be tagged distinctly (e.g. `by: 'Agent — <name>', role: 'AI'`) so the existing audit trail always shows whether a human or an agent made a given change.

## Anything else raised loosely in conversation but not written into a phase

Add future speculative ideas here as they come up, rather than letting them quietly become assumed scope in a phase document.
