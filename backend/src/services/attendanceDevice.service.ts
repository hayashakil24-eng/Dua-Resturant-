// Polls the on-site ZKTeco uFace 950 (fingerprint + face recognition
// attendance terminal) over the LAN and turns its punch log into
// AttendanceRecord rows — the "machine" half of attendance.service.ts's
// manual-override path. A no-op everywhere AppSettings.attendanceDeviceIp
// isn't set (mirrors sync/job.ts's env.vps.url gate, just DB-backed instead
// of an env var — see schema.prisma's AppSettings comment for why: an
// on-site install must never require anyone to edit a config file or
// restart the server, only fill in a Settings.jsx field). Read fresh from
// the DB on every poll, same as whatsapp/schedule.ts's maybeSendReport(), so
// a change saved in Settings takes effect on the very next tick.
//
// getAttendances() returns the device's *entire* stored punch log every
// call, not just what's new since the last poll (the uFace 950 has no
// cursor/ack concept over this protocol) — so every run recomputes
// check-in/check-out for every day that appears in the log, not just today.
// That's deliberately idempotent (re-deriving min/max punch time for a day
// always lands on the same answer) rather than wrong, but it does mean the
// per-poll cost grows with the device's own log size over time; if that ever
// matters, the fix is clearing the device's log periodically (a normal ZK
// admin operation), not adding sync-state tracking here.
//
// Enrollment (the actual fingerprint/face capture) always happens on the
// device itself — this integration only ever reads punches back, it never
// pushes user data to the device.

import ZKLib from 'node-zklib'
import { prisma } from '../db/client.js'
import { env } from '../env.js'
import { broadcastEvent } from '../realtime/broadcast.js'
import type { Actor } from '../lib/actor.js'

// Background job, no signed-in caller — same "synthetic actor" shape used by
// auth.service.ts's signup() for its own unauthenticated flow.
const DEVICE_ACTOR: Actor = { id: 'attendance-device', name: 'Attendance Machine', role: 'Admin' }

function startOfDay(d: Date): Date {
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  return day
}

export interface AttendanceDevicePollResult {
  punchesSeen: number
  recordsUpdated: number
  skippedUnknownUsers: number
  error?: string
}

// In-memory, like backup.ts's lastBackupInfo() — good enough for a single
// long-running server process, and Settings' health card only needs "did we
// last reach it" across the process lifetime, not a durable history.
let lastSuccessfulPollAt: Date | null = null

const SETTINGS_ID = 'singleton'

export async function getAttendanceDeviceStatus(): Promise<{ configured: boolean; lastSyncAt: string | null }> {
  const settings = await prisma.appSettings.findUnique({ where: { id: SETTINGS_ID } })
  return { configured: Boolean(settings?.attendanceDeviceIp), lastSyncAt: lastSuccessfulPollAt?.toISOString() ?? null }
}

// Single-flight guard: the scheduled job (every pollIntervalMs) and the
// manual "Sync Now" button both call this, and a click landing near a
// scheduled tick is entirely plausible at a 30s default interval. Cheap ZK
// terminals are known to handle a second concurrent TCP session poorly, so
// an overlapping call attaches to the in-progress poll's result instead of
// opening its own connection to the device.
let inFlightPoll: Promise<AttendanceDevicePollResult | null> | null = null

export function pollAttendanceDeviceOnce(): Promise<AttendanceDevicePollResult | null> {
  if (inFlightPoll) return inFlightPoll
  inFlightPoll = pollAttendanceDeviceOnceInternal().finally(() => {
    inFlightPoll = null
  })
  return inFlightPoll
}

async function pollAttendanceDeviceOnceInternal(): Promise<AttendanceDevicePollResult | null> {
  const settings = await prisma.appSettings.findUnique({ where: { id: SETTINGS_ID } })
  if (!settings?.attendanceDeviceIp) return null

  const zk = new ZKLib(settings.attendanceDeviceIp, settings.attendanceDevicePort, 10_000, 4000)
  let punchesSeen = 0
  let recordsUpdated = 0
  let skippedUnknownUsers = 0

  try {
    await zk.createSocket()
    const { data: punches } = await zk.getAttendances()
    punchesSeen = punches.length

    const deviceIds = [...new Set(punches.map((p) => p.deviceUserId))]
    const staffRows = await prisma.staff.findMany({ where: { deviceUserId: { in: deviceIds } } })
    const staffByDeviceId = new Map(staffRows.map((s) => [s.deviceUserId as string, s]))

    const groups = new Map<string, { staffId: string; date: Date; punches: Date[] }>()
    for (const punch of punches) {
      const staff = staffByDeviceId.get(punch.deviceUserId)
      if (!staff) {
        // A device user nobody has linked to a Staff row yet (Employees page)
        // — not fatal, just not attributable yet.
        skippedUnknownUsers++
        continue
      }
      const date = startOfDay(punch.recordTime)
      const key = `${staff.id}:${date.toISOString()}`
      const group = groups.get(key)
      if (group) group.punches.push(punch.recordTime)
      else groups.set(key, { staffId: staff.id, date, punches: [punch.recordTime] })
    }

    for (const group of groups.values()) {
      group.punches.sort((a, b) => a.getTime() - b.getTime())
      const checkIn = group.punches[0] ?? null
      const checkOut = group.punches.length > 1 ? (group.punches[group.punches.length - 1] ?? null) : null

      const existing = await prisma.attendanceRecord.findUnique({
        where: { staffId_date: { staffId: group.staffId, date: group.date } },
      })
      // A Manager's emergency manual override (used specifically because the
      // machine failed) must win until something explicit changes it — never
      // let the machine catching up later silently overwrite it back.
      if (existing?.source === 'manual') continue

      const status = checkOut ? 'Checked Out' : checkIn ? 'Present' : 'Absent'
      await prisma.attendanceRecord.upsert({
        where: { staffId_date: { staffId: group.staffId, date: group.date } },
        create: { staffId: group.staffId, date: group.date, checkIn, checkOut, status, source: 'machine' },
        update: { checkIn, checkOut, status, source: 'machine' },
      })
      recordsUpdated++
    }

    // No writeAudit entry — a clock-in is routine telemetry, not a
    // discretionary action, same "hot-path broadcast, no audit row" call
    // orders.service.ts makes for addOrder/markPaid (see broadcast.ts).
    if (recordsUpdated > 0) {
      broadcastEvent({ action: 'ATTENDANCE_MACHINE_SYNC', actor: DEVICE_ACTOR, details: { recordsUpdated } })
    }

    lastSuccessfulPollAt = new Date()
    return { punchesSeen, recordsUpdated, skippedUnknownUsers }
  } catch (err) {
    return { punchesSeen, recordsUpdated, skippedUnknownUsers, error: (err as Error).message }
  } finally {
    try {
      await zk.disconnect()
    } catch {
      // Best-effort — the socket may never have connected in the first place.
    }
  }
}

export function startAttendanceDevicePolling(): NodeJS.Timeout {
  pollAttendanceDeviceOnce().catch(() => {})
  return setInterval(() => {
    pollAttendanceDeviceOnce().catch(() => {})
  }, env.attendanceDevicePollIntervalMs)
}
