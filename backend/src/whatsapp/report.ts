// Shared by both send paths (schedule.ts's automated daily send, and
// vps/app.ts's on-demand webhook reply) — "render the most recently saved
// closing and send it to someone." The only difference between the two
// paths is what triggers the call and which database it runs against (the
// local server's own DB for the schedule; the VPS's synced copy for the
// webhook) — the prisma import is the shared singleton either way, pointed
// wherever this process's DATABASE_URL says.

import { getLatestClosing } from '../services/closing.service.js'
import { renderClosingReportImage } from '../reports/whatsappReport.js'
import { sendReportImage } from './client.js'
import type { ClosingReport } from '../core/closing.js'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function dayNameFor(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '' : DAY_NAMES[d.getDay()]!
}

export interface LatestClosing {
  id: string
  report: ClosingReport
}

// Null if nothing has ever been closed, or the saved record is corrupt.
export async function loadLatestClosing(): Promise<LatestClosing | null> {
  const latest = await getLatestClosing()
  if (!latest) return null
  try {
    return { id: latest.id, report: JSON.parse(latest.reportJson) as ClosingReport }
  } catch {
    return null
  }
}

export async function sendLatestClosingReport(recipient: string): Promise<{ sent: boolean; closingId?: string }> {
  const latest = await loadLatestClosing()
  if (!latest) return { sent: false }
  const png = await renderClosingReportImage(latest.report, dayNameFor(latest.report.date))
  await sendReportImage(recipient, png, `Cafe Ali — Daily Closing Report (${latest.report.date})`)
  return { sent: true, closingId: latest.id }
}
