// Drives runBackup() on a schedule, with no external cron dependency — a
// restaurant PC left running for weeks just needs "once a day it happens",
// not calendar-accurate scheduling. Checks every 15 minutes whether today's
// backup file already exists; if not and the configured hour has passed, runs
// it. This also naturally covers the "server was off at 3am, comes back up at
// 9am" case (docs' "Done when": a backup from the previous day should exist
// without anyone triggering it manually) — the very next check after boot
// catches up instead of waiting for the next scheduled hour.

import { env } from '../env.js'
import { runBackup, lastBackupInfo } from './backup.js'

const CHECK_INTERVAL_MS = 15 * 60 * 1000

function todayStamp(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function maybeRunBackup(): void {
  const now = new Date()
  if (now.getHours() < env.backupHour) return
  const last = lastBackupInfo()
  if (last && todayStamp(new Date(last.at)) === todayStamp(now)) return // already done today
  try {
    const result = runBackup(now)
    // eslint-disable-next-line no-console
    console.log(`[backup] wrote ${result.path}`)
  } catch (err) {
    // A failed backup must never take the server down — log and retry at the
    // next check instead.
    // eslint-disable-next-line no-console
    console.error('[backup] failed:', (err as Error).message)
  }
}

export function startBackupSchedule(): NodeJS.Timeout {
  maybeRunBackup() // catch up immediately on boot, don't wait for the first interval tick
  return setInterval(maybeRunBackup, CHECK_INTERVAL_MS)
}
