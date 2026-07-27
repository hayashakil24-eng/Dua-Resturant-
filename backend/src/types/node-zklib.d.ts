// node-zklib ships no types. Shape below is only what
// attendanceDevice.service.ts actually calls, taken from the installed
// package source (node_modules/node-zklib/zklib.js + utils.js's
// decodeRecordData40) rather than any published typing — deviceUserId comes
// back as a string (ascii digits sliced out of a fixed-width buffer field),
// recordTime as a real Date.
declare module 'node-zklib' {
  export interface ZkAttendanceRecord {
    userSn: number
    deviceUserId: string
    recordTime: Date
    ip: string
  }

  export default class ZKLib {
    constructor(ip: string, port: number, timeout?: number, inport?: number)
    createSocket(cbErr?: (err: unknown) => void, cbClose?: () => void): Promise<void>
    getAttendances(cb?: (percent: number, total: number) => void): Promise<{ data: ZkAttendanceRecord[]; err?: unknown }>
    disconnect(): Promise<void>
  }
}
