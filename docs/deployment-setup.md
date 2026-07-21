# Local server deployment setup (Phase 3)

One-time setup on the actual restaurant PC — not something to run in a dev
sandbox, since `pm2 startup` registers a boot-time OS service.

## Install & build

```bash
cd backend
npm install
npm run build
npm run prisma:migrate   # or `prisma migrate deploy` for an existing DB
```

## Start under PM2

```bash
npm run service:start      # pm2 start ecosystem.config.cjs
npm run service:status     # confirm it's online
npm run service:logs       # tail logs
```

## Make it survive a reboot

**Windows** (the actual target per `../requirements.md` §12):
```bash
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```

**Linux** (if ever deployed there):
```bash
pm2 startup
pm2 save
```

Either way, `pm2 save` snapshots the currently-running process list so
`pm2 startup`/`pm2-startup install` restores it on boot. Re-run `pm2 save`
after any change to `ecosystem.config.cjs`.

## Day to day

- `npm run service:restart` after deploying new code (`npm run build` first).
- `npm run service:status` / `npm run service:logs` for the "is it up" /
  "what happened" questions from docs' "basic operational visibility" bullet
  — the frontend's Settings panel (below) covers the common case so this is
  only needed for actual troubleshooting.
