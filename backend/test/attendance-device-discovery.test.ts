// No physical uFace 950 to test against — candidateHosts is pure CIDR math
// (tested directly), probeTcpPort is tested against a real local TCP server
// (a genuine socket, not a mock, since that part has nothing ZK-specific to
// fake), and confirmZkDevice mocks node-zklib the same way
// attendance-device.test.ts does.
import net from 'node:net'
import { describe, expect, it, vi } from 'vitest'

const zkState = vi.hoisted(() => ({ connectError: null as Error | null }))

vi.mock('node-zklib', () => ({
  default: class MockZKLib {
    async createSocket() {
      if (zkState.connectError) throw zkState.connectError
    }
    async disconnect() {}
  },
}))

import { candidateHosts, probeTcpPort, confirmZkDevice } from '../src/services/attendanceDeviceDiscovery.service.js'

describe('candidateHosts (CIDR math)', () => {
  it('enumerates a /24 excluding network, broadcast, and the interface\'s own address', () => {
    const hosts = candidateHosts('192.168.1.55', '255.255.255.0')
    expect(hosts).toHaveLength(253) // 254 usable minus the interface's own address
    expect(hosts).not.toContain('192.168.1.0')
    expect(hosts).not.toContain('192.168.1.255')
    expect(hosts).not.toContain('192.168.1.55')
    expect(hosts).toContain('192.168.1.1')
    expect(hosts).toContain('192.168.1.254')
  })

  it('handles a private range with the high bit set (192.168.x.x) without going negative', () => {
    // Regression check: JS bitwise ops return signed Int32, so any address
    // ≥128.x.x.x (nearly all of RFC1918 space) breaks naive & / | math that
    // only normalizes to unsigned once at the very end instead of after
    // every bitwise op.
    const hosts = candidateHosts('10.0.0.5', '255.255.255.0')
    expect(hosts).toHaveLength(253)
    expect(hosts.every((h) => h.startsWith('10.0.0.'))).toBe(true)
  })

  it('falls back to the /24 containing the interface address for an oversized network', () => {
    // A /16 has 65534 usable hosts — far past MAX_HOSTS_TO_SCAN — so this
    // must not attempt to sweep the whole thing.
    const hosts = candidateHosts('10.5.3.9', '255.255.0.0')
    expect(hosts).toHaveLength(253)
    expect(hosts.every((h) => h.startsWith('10.5.3.'))).toBe(true)
  })
})

describe('probeTcpPort', () => {
  it('resolves true for a port something is actually listening on', async () => {
    const server = net.createServer()
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as net.AddressInfo).port
    try {
      await expect(probeTcpPort('127.0.0.1', port, 1000)).resolves.toBe(true)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('resolves false for a closed port', async () => {
    const server = net.createServer()
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as net.AddressInfo).port
    await new Promise<void>((resolve) => server.close(() => resolve()))
    // Nothing is listening on `port` anymore — connection should be refused,
    // not need to wait out the full timeout.
    await expect(probeTcpPort('127.0.0.1', port, 1000)).resolves.toBe(false)
  })
})

describe('confirmZkDevice', () => {
  it('resolves true when the ZK handshake succeeds', async () => {
    zkState.connectError = null
    await expect(confirmZkDevice('127.0.0.1', 4370)).resolves.toBe(true)
  })

  it('resolves false when the ZK handshake fails (port open, but not actually a ZK device)', async () => {
    zkState.connectError = new Error('unexpected response')
    await expect(confirmZkDevice('127.0.0.1', 4370)).resolves.toBe(false)
    zkState.connectError = null
  })
})
