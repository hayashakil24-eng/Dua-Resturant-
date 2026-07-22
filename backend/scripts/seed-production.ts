// One-time bootstrap for a freshly-wiped production database (the VPS,
// docs/deployment-setup.md's "VPS server deployment" section) — deliberately
// NOT prisma/seed.ts, which mixes the real menu in with dev/demo fixtures
// (staff logins with a hardcoded password, demo orders, placeholder
// inventory quantities) that have no place in real production data. This
// seeds only what's genuinely real and structural: the client's actual menu
// (menu-data.json, same source seed.ts uses), department routing, and the
// real table layout. No staff, no inventory, no recipes, no demo orders —
// those are either onboarded for real (staff signup/approval) or entered by
// the client once live (inventory counts), not something to fabricate here.
//
// Run with `DATABASE_URL=<postgres-url> npx tsx scripts/seed-production.ts`
// against an EMPTY database (e.g. right after `prisma migrate reset`) — it
// does not wipe anything itself, unlike prisma/seed.ts.

import { readFile } from 'node:fs/promises'
import { prisma } from '../src/db/client.js'

async function main() {
  const existingMenuItems = await prisma.menuItem.count()
  if (existingMenuItems > 0) {
    throw new Error(
      `Refusing to run: ${existingMenuItems} MenuItem row(s) already exist. This script is for bootstrapping an empty database only — wipe it first (prisma migrate reset) if you really mean to reseed.`,
    )
  }

  console.log('Seeding MenuItem (representative subset with cost estimates)...')
  const ratio: Record<string, number> = {
    Coladas: 0.3,
    Slush: 0.25,
    'Fresh Juice': 0.35,
    Shakes: 0.32,
    'Chicken Karahi': 0.42,
    'Pakistani Cuisine': 0.4,
    Breads: 0.25,
    Soups: 0.3,
    'Kids Special': 0.35,
    'Burgers & Sandwiches': 0.38,
  }
  const menuSeed = [
    { id: 'cd1', name: 'Pina Colada', category: 'Coladas', price: 550, image: '/Pina Colada.jfif' },
    { id: 'sl3', name: 'Mango Slush', category: 'Slush', price: 350, image: '/Mango Slush.jfif' },
    { id: 'jc1', name: 'Apple Juice', category: 'Fresh Juice', price: 350, image: '/Apple Juice.jfif' },
    { id: 'sk1', name: 'Icecream Shake', category: 'Shakes', price: 550, image: '/Icecream Shake.jfif' },
    { id: 'ckh1', name: 'Chicken Shahi Karahi', category: 'Chicken Karahi', price: 2699, image: '/chicken karahi.jfif' },
    { id: 'ckh2', name: 'Chicken White Karahi', category: 'Chicken Karahi', price: 2699, image: '/Chicken White Karahi.jpg' },
    { id: 'pk5', name: 'Special Chicken Biryani Double', category: 'Pakistani Cuisine', price: 700, image: '/briyani picture.jpg' },
    { id: 'br2', name: 'Garlic Naan', category: 'Breads', price: 150, image: '/naan.jfif' },
    { id: 'sp1', name: 'Chicken Corn Soup', category: 'Soups', price: 499, image: '/Soups.jfif' },
    { id: 'kd2', name: 'French Fries', category: 'Kids Special', price: 345, image: '/Fries.jpeg' },
    { id: 'bg1', name: 'Zinger Burger with Cheese', category: 'Burgers & Sandwiches', price: 1050, image: '/Zinger Burger with Cheese.jfif' },
  ]
  for (const m of menuSeed) {
    const r = ratio[m.category] ?? 0.35
    await prisma.menuItem.create({
      data: { ...m, active: true, cost: Math.round(m.price * r), costEstimated: true, reusable: false },
    })
  }

  console.log('Seeding MenuItem (real Café Ali menu — full)...')
  const realMenuPath = new URL('../prisma/menu-data.json', import.meta.url)
  const realMenu: {
    name: string
    category: string
    price: number
    image: string | null
    description: string | null
    variants?: { label: string; price: number }[]
  }[] = JSON.parse(await readFile(realMenuPath, 'utf-8'))
  for (const item of realMenu) {
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

  console.log('Seeding Department (routing the 11-item subset above — the full real menu is unrouted until Admin assigns it)...')
  const bevItems = ['cd1', 'sl3', 'jc1', 'sk1']
  const kitchenItems = ['ckh1', 'ckh2', 'pk5', 'br2', 'sp1', 'kd2', 'bg1']
  await prisma.department.create({
    data: {
      id: 'DEPT-BEV',
      name: 'Beverages Counter',
      nameUrdu: 'مشروبات کاؤنٹر',
      description: 'Coladas, slush, juices, shakes, mocktails & ice cream',
      status: 'active',
      items: { connect: bevItems.map((id) => ({ id })) },
    },
  })
  await prisma.department.create({
    data: { id: 'DEPT-BBQ', name: 'BBQ Counter', nameUrdu: 'بی بی کیو کاؤنٹر', description: 'Grilled BBQ — beef, chicken & specials', status: 'active' },
  })
  await prisma.department.create({
    data: {
      id: 'DEPT-KITCHEN',
      name: 'Main Kitchen',
      nameUrdu: 'مرکزی باورچی خانہ',
      description: 'Karahi, handi, rice, Pakistani & continental cuisine',
      status: 'active',
      items: { connect: kitchenItems.map((id) => ({ id })) },
    },
  })

  console.log('Seeding Tables (A-G x40, HUT x20, Delivery/Takeaway)...')
  const TABLE_CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'HUT']
  const countFor = (cat: string) => (cat === 'HUT' ? 20 : 40)
  let tableId = 1
  const tableRows: { id: number; number: string; category: string; section: string; seats: number; orderType?: string; locked?: boolean }[] = []
  for (const category of TABLE_CATEGORIES) {
    const outdoor = category === 'HUT'
    for (let i = 1; i <= countFor(category); i++) {
      tableRows.push({ id: tableId, number: `${category}${i}`, category, section: outdoor ? 'Outdoor' : 'Indoor', seats: 4 })
      tableId++
    }
  }
  tableRows.push({ id: 301, number: 'Delivery', category: 'Special', section: 'Special', seats: 0, orderType: 'delivery', locked: true })
  tableRows.push({ id: 302, number: 'Takeaway', category: 'Special', section: 'Special', seats: 0, orderType: 'takeaway', locked: true })
  await prisma.table.createMany({ data: tableRows })

  const menuCount = await prisma.menuItem.count()
  const deptCount = await prisma.department.count()
  const tableCount = await prisma.table.count()
  console.log(`Done. Seeded ${menuCount} menu items, ${deptCount} departments, ${tableCount} tables.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
