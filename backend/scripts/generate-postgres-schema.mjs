#!/usr/bin/env node
// Derives prisma/postgres/schema.prisma from the canonical prisma/schema.prisma
// (docs/05-phase-4-vps-sync.md flagged this exact gap: "the local and VPS
// deployments will need their own schema file ... not just a different
// DATABASE_URL"). Generated, not hand-maintained — the 26 models must never
// drift between the two deployments, so this script is the only place a
// postgres-specific schema is produced, run before any `vps:prisma:*` command.
//
// binaryTargets is dropped for the postgres schema: unlike the local schema
// (which ships a prebuilt Windows engine because the restaurant PC never runs
// `prisma generate` itself), the VPS deploy step runs `prisma generate` on
// the VPS host directly, so "native" is always correct there and we don't
// need to guess the VPS's OS/libc in advance.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDir = dirname(dirname(fileURLToPath(import.meta.url)))
const srcPath = join(backendDir, 'prisma', 'schema.prisma')
const outDir = join(backendDir, 'prisma', 'postgres')
const outPath = join(outDir, 'schema.prisma')

const src = readFileSync(srcPath, 'utf8')

const datasourceRe = /datasource db \{[^}]*\}/
if (!datasourceRe.test(src)) {
  throw new Error(`Could not find a datasource block in ${srcPath} — is the schema format still what this script expects?`)
}
let out = src.replace(datasourceRe, 'datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}')

const binaryTargetsRe = /\n\s*binaryTargets\s*=\s*\[[^\]]*\]/
if (!binaryTargetsRe.test(out)) {
  throw new Error(`Could not find generator's binaryTargets line in ${srcPath} — is the schema format still what this script expects?`)
}
out = out.replace(binaryTargetsRe, '')

const header = `// GENERATED FILE — do not edit by hand.
// Produced from ../schema.prisma by scripts/generate-postgres-schema.mjs.
// Run \`npm run vps:schema:build\` (or any vps:prisma:* script, which runs it
// automatically) to regenerate after changing the canonical schema.

`

mkdirSync(outDir, { recursive: true })
writeFileSync(outPath, header + out)
console.log(`Wrote ${outPath}`)
