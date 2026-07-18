// Read the audit trail back in the flat shape the frontend expects
// ({ id, action, by, role, at, ...action-specific details }) — the inverse of
// lib/audit.ts's write, re-spreading detailsJson onto the row. Read-only;
// there's no mutating audit route (entries are only ever appended as a
// side-effect of other actions).

import { prisma } from '../db/client.js'

function safeParse(json: string): Record<string, unknown> {
  try {
    const v = JSON.parse(json)
    return v && typeof v === 'object' && !Array.isArray(v) ? v : { details: v }
  } catch {
    return {}
  }
}

export async function listAudit(limit = 200) {
  const rows = await prisma.auditLogEntry.findMany({ orderBy: { at: 'desc' }, take: limit })
  return rows.map((r) => ({ id: r.id, action: r.action, by: r.by, role: r.role, at: r.at.toISOString(), ...safeParse(r.detailsJson) }))
}
