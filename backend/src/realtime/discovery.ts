// LAN device discovery (docs/04-phase-3-deployment-hardening.md): a new POS
// terminal or KDS screen finds the server PC's IP without a staff member
// typing it in (relevant to requirements.md §13's non-technical install
// process). Plain UDP broadcast/reply rather than a full mDNS/Bonjour library
// — one well-known port, one request string, one JSON reply — because the
// only client is our own Electron main process (dgram is a Node API, not
// available to a browser renderer), so there's no interop requirement with
// third-party mDNS browsers to justify the extra dependency weight.

import dgram from 'node:dgram'
import { env } from '../env.js'

export const DISCOVERY_PORT = 41234
const REQUEST_MESSAGE = 'CAFE_ALI_DISCOVER'

export function startDiscoveryResponder(): dgram.Socket {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

  socket.on('message', (msg, rinfo) => {
    if (msg.toString() !== REQUEST_MESSAGE) return
    const reply = Buffer.from(JSON.stringify({ name: 'Cafe Ali', port: env.port }))
    socket.send(reply, rinfo.port, rinfo.address)
  })

  socket.on('error', (err) => {
    // Never crash the main server over a discovery-socket problem (e.g. the
    // port already bound by another process) — this is a convenience
    // feature, not core functionality.
    // eslint-disable-next-line no-console
    console.error('[discovery] socket error, LAN auto-discovery disabled:', err.message)
  })

  socket.bind(DISCOVERY_PORT, () => {
    socket.setBroadcast(true)
  })

  return socket
}
