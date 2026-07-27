// "Scan for device" (Settings.jsx) — the closest thing to zero-touch setup
// the ZK protocol actually allows. ZKTeco's own SDK has a SearchDevice
// function, but it turns out to live inside a 32-bit Windows COM/ActiveX DLL
// (ZKEMKeeper.dll) with an undocumented, unverifiable broadcast format — not
// something safe to reimplement blind, and not portable to this backend
// anyway. The documented wire protocol (port 4370, what node-zklib speaks)
// has no discovery command at all.
//
// So instead: TCP-probe every host on the server's local subnet for an open
// port 4370, then confirm each hit is actually a ZK device (not some other
// service that happens to be listening there) using the exact same
// CMD_CONNECT handshake pollAttendanceDeviceOnce() already relies on —
// real, tested behavior, not a guess about an undocumented protocol.

import net from 'node:net'
import os from 'node:os'
import ZKLib from 'node-zklib'

const ATTENDANCE_DEVICE_PORT = 4370
// A restaurant LAN is a home-router-shaped /24 (254 hosts) in the near-
// universal case. Cap how much we're ever willing to sweep so a server with
// a much larger network (e.g. a VPN interface, /16) can't turn a "few
// seconds" button into a multi-minute scan.
const MAX_HOSTS_TO_SCAN = 512
const TCP_PROBE_TIMEOUT_MS = 250
const TCP_PROBE_CONCURRENCY = 40
const ZK_HANDSHAKE_TIMEOUT_MS = 3000

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
}

function intToIp(n: number): string {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}

function hostRange(address: string, netmask: string): string[] {
  const maskInt = ipToInt(netmask)
  // `&`/`|` return a signed Int32 in JS — for any address with the top bit
  // set (which is most of RFC1918 space: every 192.168.x.x, 172.16-31.x.x,
  // and half of 10.x.x.x), that comes back negative unless normalized with
  // `>>> 0` right after *each* bitwise op, not just once at the end.
  const netInt = (ipToInt(address) & maskInt) >>> 0
  const broadcastInt = (netInt | (~maskInt >>> 0)) >>> 0
  const hosts: string[] = []
  for (let i = netInt + 1; i < broadcastInt; i++) hosts.push(intToIp(i))
  return hosts
}

// Exported for testing — pure CIDR math, no sockets. Falls back to the /24
// containing the interface's own address when the real network is too big
// to sweep (see MAX_HOSTS_TO_SCAN above).
export function candidateHosts(interfaceAddress: string, interfaceNetmask: string): string[] {
  let hosts = hostRange(interfaceAddress, interfaceNetmask)
  if (hosts.length > MAX_HOSTS_TO_SCAN) {
    hosts = hostRange(interfaceAddress, '255.255.255.0')
  }
  return hosts.filter((h) => h !== interfaceAddress)
}

// Node briefly returned `family` as the number 4/6 instead of the string
// 'IPv4'/'IPv6' (v18.0.0–18.3.x, reverted in 18.4.0 after it broke enough
// packages — nodejs/node#42787). This runs fine on the Node versions this
// project actually targets, but the backend can also be launched as a plain
// `node dist/src/server.js` on whatever Node happens to be installed on a
// client's PC, so checking both forms costs nothing and removes the risk
// entirely rather than assuming a Node version.
function isIPv4(family: string | number): boolean {
  return family === 'IPv4' || family === 4
}

function localIPv4Interfaces(): { address: string; netmask: string }[] {
  const nets = os.networkInterfaces()
  const result: { address: string; netmask: string }[] = []
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (isIPv4(iface.family) && !iface.internal) result.push({ address: iface.address, netmask: iface.netmask })
    }
  }
  return result
}

// Exported for testing — a real (if tiny) TCP connect, not a mock, so this
// is exercised against an actual local server in the test rather than
// assumed correct.
export function probeTcpPort(ip: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
    socket.connect(port, ip)
  })
}

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let index = 0
  async function worker() {
    while (index < items.length) {
      const current = items[index++]
      if (current !== undefined) await fn(current)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

// Exported for testing — confirms a host that answered on port 4370 is
// actually speaking the ZK protocol, not some unrelated service.
export async function confirmZkDevice(ip: string, port: number): Promise<boolean> {
  const zk = new ZKLib(ip, port, ZK_HANDSHAKE_TIMEOUT_MS, 4000)
  try {
    await zk.createSocket()
    return true
  } catch {
    return false
  } finally {
    try {
      await zk.disconnect()
    } catch {
      // Best-effort — the socket may never have connected in the first place.
    }
  }
}

export async function scanForAttendanceDevices(): Promise<string[]> {
  const hostSet = new Set<string>()
  for (const iface of localIPv4Interfaces()) {
    for (const host of candidateHosts(iface.address, iface.netmask)) hostSet.add(host)
  }

  const openHosts: string[] = []
  await mapWithConcurrency([...hostSet], TCP_PROBE_CONCURRENCY, async (ip) => {
    if (await probeTcpPort(ip, ATTENDANCE_DEVICE_PORT, TCP_PROBE_TIMEOUT_MS)) openHosts.push(ip)
  })

  // Sequential, not concurrent — openHosts is normally 0-2 entries (a real
  // device plus maybe a false-positive from something else on 4370), and the
  // ZK handshake shouldn't run many-at-once against unknown hardware.
  const confirmed: string[] = []
  for (const ip of openHosts) {
    if (await confirmZkDevice(ip, ATTENDANCE_DEVICE_PORT)) confirmed.push(ip)
  }
  return confirmed
}
