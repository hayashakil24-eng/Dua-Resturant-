#!/usr/bin/env node
// Prisma's CLI (`migrate deploy`, invoked by control-panel/electron/main.js's
// runMigrations() at every launch) needs a "schema-engine" binary matching the
// OS it runs on. @prisma/engines only downloads the binary for whatever OS ran
// `npm install` — on this Linux dev/build machine, that's the Linux one. A
// fresh Windows install then finds no windows schema-engine binary bundled,
// and the CLI's own fix-up-on-first-run tries to download one straight into
// Program Files, which fails there without elevation:
//   EPERM: operation not permitted, copyfile '...\partial' ->
//   'C:\Program Files\...\node_modules\@prisma\engines\schema-engine-windows.exe.tmp...'
// (This is the schema-engine counterpart to the query-engine problem
// control-panel/electron/main.js's runMigrations() already works around via
// PRISMA_QUERY_ENGINE_LIBRARY — that fix only ever covered the query engine,
// not this separate migrate-deploy-time binary.)
//
// Fix: pre-fetch the Windows binary here (a plain file download — no need to
// execute a .exe on this Linux machine) and place it exactly where the CLI's
// own engine-resolution already checks first (@prisma/engines/schema-engine-
// windows.exe) — if it's already there, the CLI skips downloading entirely,
// no code/env-var changes needed on the Windows side. Runs as `backend`'s own
// postinstall so every future `npm install` (this machine, CI, or a fresh
// clone) keeps this current automatically, rather than being a manual step
// someone has to remember before packaging control-panel.

// Both @prisma/fetch-engine and @prisma/engines-version are CommonJS —
// named imports crash under Node's ESM loader here the same way
// electron-updater's did in frontend/electron/main.js (see that file's
// comment): default-import + destructure instead.
import fetchEnginePkg from '@prisma/fetch-engine'
import enginesVersionPkg from '@prisma/engines-version'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const { download } = fetchEnginePkg
const { enginesVersion } = enginesVersionPkg

const backendDir = dirname(dirname(fileURLToPath(import.meta.url)))
const targetDir = join(backendDir, 'node_modules', '@prisma', 'engines')

try {
  const result = await download({
    binaries: { 'schema-engine': targetDir },
    binaryTargets: ['windows'],
    version: enginesVersion,
  })
  console.log(`[fetch-windows-schema-engine] ready: ${result['schema-engine'].windows}`)
} catch (err) {
  // Non-fatal: this only matters for packaging control-panel for Windows: a
  // plain `npm install` on any other machine (e.g. CI running the SQLite test
  // suite) shouldn't fail just because it couldn't reach Prisma's engine CDN.
  console.warn('[fetch-windows-schema-engine] could not pre-fetch the Windows schema-engine binary — control-panel Windows packaging will hit the EPERM bug described above unless this is retried before packaging.', err.message)
}
