// One-time data corrections for already-seeded databases — distinct from
// seedBaseline.ts (which only fills EMPTY collections on a fresh install).
// This exists because a prior menu edit marked ~40 Karahi/Handi/Platter items
// with description "Per Kg" as a plain text note, without actually flipping
// their Billing Unit to "kg" (still on Half/Full variants) — so the POS kept
// showing the old variant popup. menu-data.json / seedBaseline.ts are now
// correct for any FUTURE fresh install, but an install that was seeded
// before this fix (e.g. the client's already-running restaurant PC) keeps
// its existing menu rows untouched by either of those — this backfills
// those specific rows in place.
//
// Idempotent like seedBaseline: the WHERE filter only matches items still on
// the old (unit != 'kg', description mentions "Per Kg") combination, so once
// applied it naturally becomes a no-op on every later startup. Safe to call
// unconditionally alongside seedBaseline().
import { prisma } from './client.js'

export async function backfillKgBilledMenuItems(): Promise<number> {
  const candidates = await prisma.menuItem.findMany({
    where: { unit: { not: 'kg' } },
    include: { variants: true },
  })
  const targets = candidates.filter((item) => /per kg/i.test(item.description || ''))

  for (const item of targets) {
    const fullVariant = item.variants.find((v) => /full/i.test(v.label))
    const newPrice = fullVariant ? fullVariant.price : item.price
    await prisma.$transaction([
      prisma.menuItemVariant.deleteMany({ where: { menuItemId: item.id } }),
      prisma.menuItem.update({
        where: { id: item.id },
        data: { unit: 'kg', price: newPrice, description: 'Per Kg — enter exact weight at the POS' },
      }),
    ])
  }

  return targets.length
}
