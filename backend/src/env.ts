// Central config, read once at startup. Fastify/Prisma both read process.env
// directly for their own concerns (DATABASE_URL); this module is only for the
// values our own code needs — kept here so a missing secret fails loudly at
// boot instead of producing unverifiable tokens at runtime.

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (v == null || v === '') {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return v
}

export const env = {
  // Never hard-fails in dev because .env supplies it, but the fallback keeps
  // `vitest` (which doesn't load .env) able to build the app for smoke tests.
  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-change-me'),
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '127.0.0.1',
  // Phase 3 local backup (docs/04-phase-3-deployment-hardening.md): stands in
  // for "the external drive/USB" — a real on-site install points this at
  // that mount path (e.g. "D:\\CafeAliBackups" on Windows). Defaults to a
  // sibling folder so `npm run dev` has somewhere sane to write during
  // development without any setup.
  backupDir: process.env.BACKUP_DIR ?? 'backups',
  // 24h clock hour (0-23) the daily backup runs at, local server time.
  backupHour: Number(process.env.BACKUP_HOUR ?? 3),
}
