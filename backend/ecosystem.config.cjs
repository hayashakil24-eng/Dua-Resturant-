// PM2 process definition for the local restaurant-PC deployment
// (docs/04-phase-3-deployment-hardening.md). PM2 itself is cross-platform
// (Windows via `pm2-windows-startup`, Linux/macOS via `pm2 startup`), so one
// config covers both the actual Windows target and this dev sandbox.
//
// Run the built server (`npm run build` first), not `tsx watch` — file
// watching has no place in a background service that's meant to survive
// unattended for weeks.
module.exports = {
  apps: [
    {
      name: 'cafe-ali-backend',
      // tsconfig's rootDir is "." (compiles src/ + prisma/ + test/ together),
      // so the built entry point lands at dist/src/server.js, not dist/server.js
      // — matches the existing (pre-Phase-3) tsconfig, not something to "fix"
      // here since package.json's own `start` script has the same path shape.
      script: 'dist/src/server.js',
      cwd: __dirname,
      // Crash-only restart, not a health-poll loop — Fastify listening
      // successfully is itself the sign of health; the deployment story is
      // "no technical person should ever need to look at this", so simplest
      // supervision that just works is the goal (docs' own framing).
      autorestart: true,
      max_restarts: 15,
      min_uptime: '10s',
      // A crash-loop (bad build, missing .env, port already bound) shouldn't
      // hammer indefinitely — back off exponentially between attempts.
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
