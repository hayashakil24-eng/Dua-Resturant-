// Drives the automated daily WhatsApp report (requirements.md §6/§7),
// modeled directly on backup/schedule.ts's pattern: no external cron
// dependency, just a periodic check for "should this have happened by now."
//
// Sends the most recently *saved* DailyClosing (not a live/open-session
// preview) — that's what the client's own manual process shares (a
// completed day's finalized figures, not a mid-day snapshot), and it's also
// the same authoritative, tamper-resistant record the Closing page itself
// saves (closing.service.ts's saveDailyClosing).
//
// "Already sent?" is tracked by closing id (AppSettings.whatsappReportLastSentClosingId),
// checked BEFORE rendering/sending — not just a date, so this survives a
// server restart and naturally re-sends if a *new* closing appears rather
// than being keyed to a calendar date that might not match session
// boundaries (see core/closing.ts's "business-day session" comment). If
// closing is late, this still catches up at the next 15-minute check after
// it happens; if no closing exists yet, nothing sends; if the server was
// off when the hour passed, the next check after boot catches up — same
// "resilient to an unattended PC" properties runBackup already has.

import { prisma } from '../db/client.js'
import { sendLatestClosingReport } from './report.js'
import { isWhatsAppConfigured } from './client.js'

const CHECK_INTERVAL_MS = 15 * 60 * 1000
const SETTINGS_ID = 'singleton'

async function maybeSendReport(): Promise<void> {
  if (!isWhatsAppConfigured()) return
  const settings = await prisma.appSettings.findUnique({ where: { id: SETTINGS_ID } })
  if (!settings?.whatsappReportEnabled || !settings.whatsappReportRecipient) return
  if (new Date().getHours() < settings.whatsappReportHour) return

  const latest = await prisma.dailyClosing.findFirst({ orderBy: { closingTime: 'desc' }, select: { id: true } })
  if (!latest) return // nothing closed yet — nothing to send
  if (latest.id === settings.whatsappReportLastSentClosingId) return // already sent this one

  try {
    await sendLatestClosingReport(settings.whatsappReportRecipient)
    await prisma.appSettings.update({ where: { id: SETTINGS_ID }, data: { whatsappReportLastSentClosingId: latest.id } })
    console.log(`[whatsapp-report] sent latest closing (${latest.id}) to ${settings.whatsappReportRecipient}`)
  } catch (err) {
    // A failed send must never take the server down, and must NOT be marked
    // sent — left unset so the next check (15 min later) retries.
    console.error('[whatsapp-report] failed:', (err as Error).message)
  }
}

export function startWhatsappReportSchedule(): NodeJS.Timeout {
  maybeSendReport().catch(() => {})
  return setInterval(() => {
    maybeSendReport().catch(() => {})
  }, CHECK_INTERVAL_MS)
}
