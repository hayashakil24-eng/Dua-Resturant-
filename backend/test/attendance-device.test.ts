// No physical uFace 950 to test against, so node-zklib is mocked here —
// zkState is the only thing tests reach into, standing in for "what the
// device would say" on each poll. Device IP/port live in AppSettings (the
// DB), not an env var (Settings.jsx is the only way to set them in the real
// app — see attendanceDevice.service.ts's file header), so this test seeds
// that row directly rather than touching process.env.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '../src/db/client.js'
import { pollAttendanceDeviceOnce } from '../src/services/attendanceDevice.service.js'

const SETTINGS_ID = 'singleton'

const zkState = vi.hoisted(() => ({
  attendances: [] as { deviceUserId: string; recordTime: Date }[],
  connectError: null as Error | null,
}))

vi.mock('node-zklib', () => ({
  default: class MockZKLib {
    async createSocket() {
      if (zkState.connectError) throw zkState.connectError
    }
    async getAttendances() {
      return { data: zkState.attendances.map((r, i) => ({ userSn: i, ip: '127.0.0.1', ...r })) }
    }
    async disconnect() {}
  },
}))

let staffA: { id: string }
let staffB: { id: string }

beforeAll(async () => {
  staffA = await prisma.staff.create({ data: { name: 'Device Test A', role: 'Waiter', deviceUserId: 'DEV-TEST-A' } })
  staffB = await prisma.staff.create({ data: { name: 'Device Test B', role: 'Waiter', deviceUserId: 'DEV-TEST-B' } })
  // Seeds the same row Settings.jsx's "Save" writes to — the service reads
  // this fresh on every poll (see its file header), so no restart needed.
  await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, attendanceDeviceIp: '127.0.0.1', attendanceDevicePort: 4370 },
    update: { attendanceDeviceIp: '127.0.0.1', attendanceDevicePort: 4370 },
  })
})

afterEach(async () => {
  zkState.attendances = []
  zkState.connectError = null
  await prisma.attendanceRecord.deleteMany({ where: { staffId: { in: [staffA.id, staffB.id] } } })
})

afterAll(async () => {
  await prisma.staff.delete({ where: { id: staffA.id } })
  await prisma.staff.delete({ where: { id: staffB.id } })
  // Leave the shared AppSettings row the way other tests / a real dev run
  // expect it — unconfigured, not pointed at this test's fake IP.
  await prisma.appSettings.update({ where: { id: SETTINGS_ID }, data: { attendanceDeviceIp: null } })
  await prisma.$disconnect()
})

function recordFor(staffId: string) {
  return prisma.attendanceRecord.findFirst({ where: { staffId } })
}

describe('attendanceDevice.service (configured)', () => {
  it('first punch of the day sets checkIn; a later punch sets checkOut', async () => {
    zkState.attendances = [
      { deviceUserId: 'DEV-TEST-A', recordTime: new Date('2026-07-27T09:01:00Z') },
      { deviceUserId: 'DEV-TEST-A', recordTime: new Date('2026-07-27T17:05:00Z') },
    ]
    const result = await pollAttendanceDeviceOnce()
    expect(result?.error).toBeUndefined()
    expect(result?.recordsUpdated).toBe(1)

    const record = await recordFor(staffA.id)
    expect(record?.source).toBe('machine')
    expect(record?.status).toBe('Checked Out')
    expect(record?.checkIn?.toISOString()).toBe('2026-07-27T09:01:00.000Z')
    expect(record?.checkOut?.toISOString()).toBe('2026-07-27T17:05:00.000Z')
  })

  it('a single punch sets checkIn only, status Present', async () => {
    zkState.attendances = [{ deviceUserId: 'DEV-TEST-B', recordTime: new Date('2026-07-27T09:10:00Z') }]
    await pollAttendanceDeviceOnce()

    const record = await recordFor(staffB.id)
    expect(record?.status).toBe('Present')
    expect(record?.checkIn).not.toBeNull()
    expect(record?.checkOut).toBeNull()
  })

  it('skips and counts punches from a deviceUserId not linked to any staff', async () => {
    zkState.attendances = [{ deviceUserId: 'UNKNOWN-DEVICE-ID', recordTime: new Date('2026-07-27T09:00:00Z') }]
    const result = await pollAttendanceDeviceOnce()
    expect(result?.skippedUnknownUsers).toBe(1)
    expect(result?.recordsUpdated).toBe(0)
  })

  it('never overwrites a manual override for that day', async () => {
    // Local midnight, not UTC midnight — matches startOfDay() in the service
    // under test (and startOfToday() in attendance.service.ts), so this
    // lands on the same AttendanceRecord row as the 09:01Z punch below
    // regardless of the machine's timezone.
    const date = new Date(2026, 6, 27)
    await prisma.attendanceRecord.create({
      data: {
        staffId: staffA.id,
        date,
        checkIn: new Date('2026-07-27T08:00:00Z'),
        status: 'Present',
        source: 'manual',
        manualBy: 'Test Manager',
        manualByRole: 'Manager',
        manualReason: 'Machine was down',
      },
    })
    zkState.attendances = [{ deviceUserId: 'DEV-TEST-A', recordTime: new Date('2026-07-27T09:01:00Z') }]
    await pollAttendanceDeviceOnce()

    const record = await recordFor(staffA.id)
    expect(record?.source).toBe('manual')
    expect(record?.checkIn?.toISOString()).toBe('2026-07-27T08:00:00.000Z')
  })

  it('resolves with an error result (not a throw) when the device is unreachable', async () => {
    zkState.connectError = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    const result = await pollAttendanceDeviceOnce()
    expect(result?.error).toContain('ECONNREFUSED')
    expect(result?.recordsUpdated).toBe(0)
  })
})
