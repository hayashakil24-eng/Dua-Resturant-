// Central config, read once at startup. Fastify/Prisma both read process.env
// directly for their own concerns (DATABASE_URL); this module is only for the
// values our own code needs — kept here so a missing secret fails loudly at
// boot instead of producing unverifiable tokens at runtime.

// Load backend/.env into process.env before reading anything below. Prisma
// pulls DATABASE_URL from .env on its own, but everything else here (HOST,
// PORT, JWT_SECRET, VPS_*) reads process.env directly — without this, every
// value in .env *except* the database URL was silently ignored, so e.g.
// HOST=0.0.0.0 never took effect and the server bound loopback-only, unreachable
// from other LAN devices (and from the Electron app's own discovery, which
// reports the server's LAN IP). Guarded: no .env present (vitest, or the
// Control Panel embedding this module from its own cwd) is fine — real env
// vars / the fallbacks below take over. `loadEnvFile` is Node ≥20.12 built-in;
// the optional call keeps older/typeless runtimes from throwing.
try {
  ;(process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.()
} catch {
  /* no .env file — rely on real environment variables */
}

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
  // Phase 4 (docs/05-phase-4-vps-sync.md): all optional so a plain local-only
  // run (Phases 1-3, or `npm test`) never needs these. The local server's
  // background sync job (src/sync/*) and the VPS's receiving endpoint
  // (src/vps/*) are the only things that read them.
  vps: {
    // Where the local sync job pushes to — e.g. https://cafeali-vps.example.com.
    url: process.env.VPS_URL ?? null,
    // Shared secret both sides know: the local server signs a short-lived
    // service JWT with it, the VPS verifies with the same key. Deliberately
    // separate from JWT_SECRET (staff sessions) — a leaked staff token must
    // never double as server-to-server credentials, and vice versa.
    syncSecret: process.env.VPS_SYNC_SECRET ?? null,
    port: Number(process.env.VPS_PORT ?? 5000),
    // How often the local server checks connectivity + pushes pending rows.
    syncIntervalMs: Number(process.env.VPS_SYNC_INTERVAL_MS ?? 30_000),
  },
}
