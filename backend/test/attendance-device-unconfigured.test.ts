import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db/client.js'
import { pollAttendanceDeviceOnce } from '../src/services/attendanceDevice.service.js'

const SETTINGS_ID = 'singleton'

// Explicitly clears AppSettings.attendanceDeviceIp rather than assuming a
// pristine DB — attendance-device.test.ts's own afterAll also resets it, but
// this test shouldn't depend on file run order to see the unconfigured state.
beforeAll(async () => {
  await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: { attendanceDeviceIp: null },
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('attendanceDevice.service (unconfigured)', () => {
  it('is a no-op when AppSettings.attendanceDeviceIp is unset', async () => {
    const before = await prisma.attendanceRecord.count({ where: { source: 'machine' } })
    const result = await pollAttendanceDeviceOnce()
    expect(result).toBeNull()
    const after = await prisma.attendanceRecord.count({ where: { source: 'machine' } })
    expect(after).toBe(before)
  })
})
