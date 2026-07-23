// Idempotent, non-destructive baseline seed for a freshly-migrated database
// that has no reference data yet. Needed by the Control Panel deployment: its
// `prisma migrate deploy` (unlike dev's `migrate dev`) never runs
// prisma/seed.ts, so a fresh install has a working admin login but an EMPTY
// menu and NO tables — the POS can't take an order. This fills exactly the
// reference data the app needs to function: app settings, physical tables, and
// the real menu (+ size variants).
//
// Only fills EMPTY collections (per-collection count() guard) — never wipes,
// never touches demo/transactional data (orders, staff beyond bootstrap,
// transactions, recipes, departments). Safe to call on every startup, like
// migrations; mirrors auth/bootstrap.ts's ensureAdminAccount pattern.

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { prisma } from './client.js'

interface RealMenuItem {
  name: string
  category: string
  price: number
  image: string | null
  description: string | null
  variants?: { label: string; price: number }[]
}

// menu-data.json lives at <backendRoot>/prisma/menu-data.json. This file runs
// from different depths in dev (src/db/) vs a compiled build (dist/src/db/),
// and from inside node_modules in a packaged Control Panel — so walk up from
// wherever we are until the sibling prisma/menu-data.json turns up, rather than
// hard-coding a `../..` count that only matches one of those layouts.
function resolveMenuDataPath(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'prisma', 'menu-data.json')
    if (existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('seedBaseline: prisma/menu-data.json not found near ' + fileURLToPath(import.meta.url))
}

export async function seedBaseline(): Promise<void> {
  // App settings — GST off by default (matches prisma/seed.ts's singleton).
  if ((await prisma.appSettings.count()) === 0) {
    await prisma.appSettings.create({ data: { id: 'singleton', gstEnabled: false, gstRate: 0.05 } })
  }

  // Physical tables: A–G ×40 (indoor) + HUT ×20 (outdoor) + Delivery/Takeaway
  // specials. Same layout as prisma/seed.ts:97-111.
  if ((await prisma.table.count()) === 0) {
    const CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'HUT']
    const countFor = (cat: string) => (cat === 'HUT' ? 20 : 40)
    const rows: { id: number; number: string; category: string; section: string; seats: number; orderType?: string; locked?: boolean }[] = []
    let id = 1
    for (const category of CATEGORIES) {
      const outdoor = category === 'HUT'
      for (let i = 1; i <= countFor(category); i++) {
        rows.push({ id, number: `${category}${i}`, category, section: outdoor ? 'Outdoor' : 'Indoor', seats: 4 })
        id++
      }
    }
    rows.push({ id: 301, number: 'Delivery', category: 'Special', section: 'Special', seats: 0, orderType: 'delivery', locked: true })
    rows.push({ id: 302, number: 'Takeaway', category: 'Special', section: 'Special', seats: 0, orderType: 'takeaway', locked: true })
    await prisma.table.createMany({ data: rows })
  }

  // The client's real, full menu (+ size variants) from prisma/menu-data.json.
  // No cost/recipe data in the source (name/category/price only) → cost:null,
  // costEstimated:true; Admin fills these in later via Recipes.
  if ((await prisma.menuItem.count()) === 0) {
    const menu: RealMenuItem[] = JSON.parse(await readFile(resolveMenuDataPath(), 'utf-8'))
    for (const item of menu) {
      await prisma.menuItem.create({
        data: {
          name: item.name,
          category: item.category,
          price: item.price,
          image: item.image,
          description: item.description,
          active: true,
          cost: null,
          costEstimated: true,
          reusable: false,
          variants: item.variants?.length
            ? { create: item.variants.map((v) => ({ label: v.label, price: v.price, cost: null, costEstimated: true })) }
            : undefined,
        },
      })
    }
  }
}
