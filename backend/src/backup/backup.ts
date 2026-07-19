// Local SQLite backup (docs/04-phase-3-deployment-hardening.md §"Local backup
// job"). Copies the live db file to env.backupDir — a plain fs.copyFile, not
// a Prisma/SQL-level export: SQLite is one file, so a byte-for-byte copy IS a
// consistent backup as long as nothing is mid-write, which is why this runs
// at a quiet off-hours time (env.backupHour) rather than on a tight interval.
//
// One file per day (dev-2026-07-19.db), overwritten if run twice the same
// day — running the scheduled job an hour late after a restart shouldn't
// produce two backups for one day.

import fs from 'node:fs'
import path from 'node:path'
import { env } from '../env.js'

// DATABASE_URL is "file:./dev.db", resolved by Prisma relative to
// prisma/schema.prisma's directory — mirror that resolution here rather than
// hardcoding the filename twice. Anchored on process.cwd() (the package
// root, backend/) rather than import.meta.dirname: this file's own directory
// differs between dev (tsx runs src/backup/backup.ts directly) and prod
// (node runs the compiled dist/src/backup/backup.js), but both `npm run dev`
// and PM2 (ecosystem.config.cjs sets cwd: __dirname) start with cwd = backend/.
function resolveDbPath(): string {
  const url = process.env.DATABASE_URL ?? 'file:./dev.db'
  const relative = url.replace(/^file:/, '')
  return path.resolve(process.cwd(), 'prisma', relative)
}

function resolveBackupDir(): string {
  return path.isAbsolute(env.backupDir) ? env.backupDir : path.resolve(process.cwd(), env.backupDir)
}

function dateStamp(d: Date): string {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

export interface BackupResult {
  path: string
  at: Date
}

export function runBackup(now: Date = new Date()): BackupResult {
  const dbPath = resolveDbPath()
  const dir = resolveBackupDir()
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, `dev-${dateStamp(now)}.db`)
  fs.copyFileSync(dbPath, dest)
  return { path: dest, at: now }
}

// For the Settings health panel: the most recent backup file's mtime, or
// null if none exist yet (fresh install, or the very first day before
// env.backupHour has passed).
export function lastBackupInfo(): { path: string; at: string } | null {
  const dir = resolveBackupDir()
  if (!fs.existsSync(dir)) return null
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('dev-') && f.endsWith('.db'))
    .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
  const newest = files[0]
  if (!newest) return null
  return { path: path.join(dir, newest.f), at: newest.mtime.toISOString() }
}
