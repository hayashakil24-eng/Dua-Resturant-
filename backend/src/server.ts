// Entry point for the standalone local server. Phase 3 wraps this in a
// background service (PM2/node-windows); for now `tsx src/server.ts` (or the
// built dist/server.js) runs it directly.

import { buildApp } from './app.js'
import { env } from './env.js'
import { attachSocket } from './realtime/socket.js'

const app = buildApp()

app
  .listen({ port: env.port, host: env.host })
  .then(() => {
    attachSocket(app.server)
    app.log.info(`Cafe Ali backend listening on http://${env.host}:${env.port}`)
  })
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
