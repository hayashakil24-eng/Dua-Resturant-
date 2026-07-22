// Seeds a representative subset of frontend/src/data/mockData.js into the
// real database (staff, tables, inventory, departments, demo orders — not
// exhaustive, e.g. not all 300 tables' worth of demo orders), but internally
// consistent: every id referenced by a recipe, department, order, or "most
// ordered" entry below is actually seeded, and the ckh1 (Chicken Shahi
// Karahi) recipe + order are carried over verbatim from mockData.js
// specifically because they're a known-good fixture — a live run of the
// (pre-backend) frontend confirmed this exact order (qty 2) produces
// "Chicken 1 kg, Cooking Oil 0.2 L" via calculateDeductions, which
// test/inventoryFlow.test.ts checks against.
//
// The menu itself is the one exception to "representative subset": it's the
// client's actual full menu (menu-data.json, converted from their real menu
// document), not a demo sample — see the comment above that block below.
//
// Idempotent: wipes and reseeds every run (dev convenience), not additive.

import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { prisma } from '../src/db/client.js'
import { nextSequence } from '../src/core/ids.js'
import { hashPassword } from '../src/auth/password.js'

// Exported so tests can reset the DB to a known state in-process (see
// test/orders.api.test.ts) using the same shared prisma client — the direct-run
// block at the bottom is the only place that disconnects.
export async function seed() {
  console.log('Wiping existing data...')
  // Delete in FK-dependency order (children before parents).
  await prisma.auditLogEntry.deleteMany()
  await prisma.dailyClosing.deleteMany()
  await prisma.receivableLedgerEntry.deleteMany()
  await prisma.receivable.deleteMany()
  await prisma.pendingHandover.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.shiftReconciliation.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.advance.deleteMany()
  await prisma.attendanceRecord.deleteMany()
  await prisma.ingredientRequest.deleteMany()
  await prisma.recipeIngredient.deleteMany()
  await prisma.recipe.deleteMany()
  await prisma.mostOrderedItem.deleteMany()
  await prisma.menuItemVariant.deleteMany()
  await prisma.menuItem.deleteMany()
  await prisma.department.deleteMany()
  await prisma.category.deleteMany()
  await prisma.inventoryItem.deleteMany()
  await prisma.onlineAccount.deleteMany()
  await prisma.table.deleteMany()
  await prisma.staff.deleteMany()
  await prisma.appSettings.deleteMany()
  await prisma.sequence.deleteMany()

  console.log('Seeding AppSettings...')
  await prisma.appSettings.create({
    data: { id: 'singleton', gstEnabled: false, gstRate: 0.05 }, // mockData.js TAX_RATE
  })

  console.log('Seeding Staff...')
  const staffSeed = [
    { id: 'S00', name: 'Malik Sahab', role: 'Admin', shift: 'Morning', shiftStartTime: '09:00', phone: '0300-0000000', baseSalary: 0 },
    { id: 'S01', name: 'Ali Raza', role: 'Manager', shift: 'Morning', shiftStartTime: '09:00', phone: '0300-1122334', baseSalary: 60000 },
    { id: 'S02', name: 'Hamza Khan', role: 'Cashier', shift: 'Morning', shiftStartTime: '09:00', phone: '0301-2233445', baseSalary: 38000 },
    { id: 'S03', name: 'Bilal Ahmed', role: 'Waiter', shift: 'Evening', shiftStartTime: '16:00', phone: '0302-3344556', baseSalary: 28000 },
    { id: 'S04', name: 'Usman Tariq', role: 'Waiter', shift: 'Morning', shiftStartTime: '09:00', phone: '0303-4455667', baseSalary: 28000 },
    { id: 'S05', name: 'Zain Malik', role: 'Waiter', shift: 'Evening', shiftStartTime: '16:00', phone: '0304-5566778', baseSalary: 27000 },
    { id: 'S06', name: 'Fahad Iqbal', role: 'Chef', shift: 'Morning', shiftStartTime: '09:00', phone: '0305-6677889', baseSalary: 55000 },
    { id: 'S07', name: 'Saad Nawaz', role: 'Waiter', shift: 'Evening', shiftStartTime: '16:00', phone: '0306-7788990', baseSalary: 26000 },
    { id: 'S08', name: 'Kamran Shah', role: 'Cashier', shift: 'Evening', shiftStartTime: '16:00', phone: '0307-8899001', baseSalary: 36000 },
    { id: 'K01', name: 'Ahmed Chef', role: 'Kitchen', shift: 'Morning', shiftStartTime: '09:00', phone: '0308-9900112', baseSalary: 45000 },
  ]
  // Demo login credentials for the four permission (system) roles — Phase 1
  // replaces the frontend's "pick a role, any password" Login.jsx with real
  // auth. Only staff who actually sign in get a username/passwordHash +
  // systemRole; waiters/chefs (no system access) leave them null. Passwords are
  // the dev default "1234" (change before any real deployment — Phase 3).
  const credentials: Record<string, { username: string; systemRole: string }> = {
    S00: { username: 'admin', systemRole: 'Admin' },
    S01: { username: 'manager', systemRole: 'Manager' },
    S02: { username: 'cashier', systemRole: 'Cashier' },
    K01: { username: 'kitchen', systemRole: 'Kitchen' },
  }
  const demoHash = await hashPassword('1234')
  for (const s of staffSeed) {
    const cred = credentials[s.id]
    await prisma.staff.create({
      data: {
        ...s,
        active: true,
        ...(cred ? { username: cred.username, systemRole: cred.systemRole, passwordHash: demoHash } : {}),
      },
    })
  }

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

  console.log('Seeding InventoryItem...')
  const inventorySeed = [
    { id: 'INV01', name: 'Flour (Atta)', category: 'Grains', stock: 2, unit: 'kg', threshold: 10, costPerUnit: 120 },
    { id: 'INV02', name: 'Cooking Oil', category: 'Pantry', stock: 1, unit: 'L', threshold: 8, costPerUnit: 550 },
    { id: 'INV03', name: 'Chicken', category: 'Meat', stock: 3, unit: 'kg', threshold: 12, costPerUnit: 550 },
    { id: 'INV04', name: 'Mutton', category: 'Meat', stock: 18, unit: 'kg', threshold: 10, costPerUnit: 1800 },
    { id: 'INV05', name: 'Beef', category: 'Meat', stock: 22, unit: 'kg', threshold: 10, costPerUnit: 1200 },
    { id: 'INV06', name: 'Basmati Rice', category: 'Grains', stock: 40, unit: 'kg', threshold: 15, costPerUnit: 350 },
    { id: 'INV07', name: 'Tomatoes', category: 'Vegetables', stock: 6, unit: 'kg', threshold: 8, costPerUnit: 150 },
    { id: 'INV08', name: 'Onions', category: 'Vegetables', stock: 30, unit: 'kg', threshold: 10, costPerUnit: 120 },
    { id: 'INV09', name: 'Yogurt', category: 'Dairy', stock: 9, unit: 'L', threshold: 6, costPerUnit: 220 },
    { id: 'INV10', name: 'Milk', category: 'Dairy', stock: 4, unit: 'L', threshold: 10, costPerUnit: 200 },
    { id: 'INV11', name: 'Tea Leaves', category: 'Beverages', stock: 3, unit: 'kg', threshold: 5, costPerUnit: 1400 },
    { id: 'INV12', name: 'Sugar', category: 'Pantry', stock: 25, unit: 'kg', threshold: 10, costPerUnit: 150 },
    { id: 'INV13', name: 'Spice Mix', category: 'Pantry', stock: 14, unit: 'packs', threshold: 5, costPerUnit: 180 },
    { id: 'INV14', name: 'Soft Drinks', category: 'Beverages', stock: 18, unit: 'pcs', threshold: 20, costPerUnit: 60 },
    { id: 'INV15', name: 'Mineral Water', category: 'Beverages', stock: 40, unit: 'pcs', threshold: 24, costPerUnit: 40 },
  ]
  for (const i of inventorySeed) {
    await prisma.inventoryItem.create({ data: { ...i, active: true } })
  }

  console.log('Seeding MenuItem (representative subset)...')
  // ratio = FOOD_COST_RATIO[category] from mockData.js, for just the
  // categories seeded here — cost = round(price * ratio), matching
  // withEstimatedCost()'s convention.
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

  // The client's real, full menu (menu-data.json — converted from their
  // actual "Menu New design.md" + sourced item photos). Kept separate from
  // menuSeed above: those 11 items already exist in this list too (by name),
  // deliberately excluded when the JSON was generated so they aren't
  // duplicated — they keep their fixed short ids since the recipe-deduction
  // fixture and other seeded orders below reference them directly (ckh1,
  // br2, pk5, ...). No cost/recipe data exists for these ~170 items (the
  // source menu only had name/category/price) — left as `cost: null,
  // costEstimated: true` (unknown) rather than inventing figures; Admin can
  // fill these in later via Recipes, which already tolerates items with none.
  console.log('Seeding MenuItem (real Café Ali menu — full)...')
  const realMenuPath = new URL('./menu-data.json', import.meta.url)
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

  console.log('Seeding Department (routing the seeded menu subset)...')
  const bevItems = ['cd1', 'sl3', 'jc1', 'sk1']
  const kitchenItems = ['ckh1', 'ckh2', 'pk5', 'br2', 'sp1', 'kd2', 'bg1']
  const dept1 = await prisma.department.create({
    data: {
      id: 'DEPT-BEV',
      name: 'Beverages Counter',
      nameUrdu: 'مشروبات کاؤنٹر',
      description: 'Coladas, slush, juices, shakes, mocktails & ice cream',
      status: 'active',
      items: { connect: bevItems.map((id) => ({ id })) },
    },
  })
  const dept2 = await prisma.department.create({
    data: { id: 'DEPT-BBQ', name: 'BBQ Counter', nameUrdu: 'بی بی کیو کاؤنٹر', description: 'Grilled BBQ — beef, chicken & specials', status: 'active' },
  })
  const dept3 = await prisma.department.create({
    data: {
      id: 'DEPT-KITCHEN',
      name: 'Main Kitchen',
      nameUrdu: 'مرکزی باورچی خانہ',
      description: 'Karahi, handi, rice, Pakistani & continental cuisine',
      status: 'active',
      items: { connect: kitchenItems.map((id) => ({ id })) },
    },
  })
  void dept1
  void dept2
  void dept3

  console.log('Seeding MostOrderedItem...')
  for (const menuItemId of ['cd1', 'sl3', 'sk1', 'jc1']) {
    await prisma.mostOrderedItem.create({ data: { menuItemId } })
  }

  console.log('Seeding Recipe + RecipeIngredient...')
  const recipe1 = await prisma.recipe.create({
    data: {
      menuItemId: 'ckh1',
      menuItemName: 'Chicken Shahi Karahi',
      totalCost: 330,
      status: 'approved',
      createdBy: 'Ahmed Chef',
      createdByRole: 'Kitchen',
      approvedBy: 'Admin User',
      approvedAt: new Date(),
    },
  })
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: recipe1.id, inventoryItemId: 'INV03', itemName: 'Chicken', quantity: 0.5, unit: 'kg', costPerUnit: 550, lineCost: 275 },
      { recipeId: recipe1.id, inventoryItemId: 'INV02', itemName: 'Cooking Oil', quantity: 0.1, unit: 'L', costPerUnit: 550, lineCost: 55 },
    ],
  })
  const recipe2 = await prisma.recipe.create({
    data: {
      menuItemId: 'ckh2',
      menuItemName: 'Chicken White Karahi',
      totalCost: 308,
      status: 'pending',
      createdBy: 'Ahmed Chef',
      createdByRole: 'Kitchen',
    },
  })
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: recipe2.id, inventoryItemId: 'INV03', itemName: 'Chicken', quantity: 0.5, unit: 'kg', costPerUnit: 550, lineCost: 275 },
      { recipeId: recipe2.id, inventoryItemId: 'INV09', itemName: 'Yogurt', quantity: 0.15, unit: 'L', costPerUnit: 220, lineCost: 33 },
    ],
  })

  console.log('Seeding OnlineAccount...')
  await prisma.onlineAccount.createMany({
    data: [
      { id: 'OPA-1', name: 'JazzCash - Main', type: 'JazzCash', number: '0300-1234567', active: true },
      { id: 'OPA-2', name: 'Easypaisa - Shop', type: 'Easypaisa', number: '0345-7654321', active: true },
      { id: 'OPA-3', name: 'Meezan Bank', type: 'Bank Account', number: 'PK00MEZN0000001234567', active: false },
    ],
  })

  console.log('Seeding Receivable...')
  await prisma.receivable.createMany({
    data: [
      { id: 'RCV-AK', name: 'Ali Kakar Sahab', type: 'customer', balance: 29028, status: 'open', notes: 'Regular customer' },
      { id: 'RCV-HM', name: 'Hotel Mobile Account', type: 'hotel', balance: 53886, status: 'open', notes: 'Regular hotel orders' },
      { id: 'RCV-ZM', name: 'Zamaan Account', type: 'business', balance: 0, status: 'settled', notes: 'Settled daily' },
    ],
  })

  console.log('Seeding Order + OrderItem (known-good deduction fixture)...')
  const today = new Date()
  const at = (h: number, m: number) => {
    const d = new Date(today)
    d.setHours(h, m, 0, 0)
    return d
  }

  async function seedOrder(
    table: number,
    waiter: string,
    items: { menuItemId: string; name: string; price: number; qty: number }[],
    payment: string,
    method: string,
    createdAt: Date,
  ) {
    await prisma.$transaction(async (tx) => {
      const orderNumber = await nextSequence(tx, 'order')
      await tx.order.create({
        data: {
          orderNumber,
          table,
          waiter,
          payment,
          method,
          gstRate: 0,
          kitchen: 'Served',
          createdAt,
          items: { create: items.map((it) => ({ ...it, cost: null, costEstimated: null })) },
        },
      })
    })
  }

  // Same items/qty as mockData.js ORD-1035 — gives the "Most Ordered" seed
  // some real order history.
  await seedOrder(
    4,
    'Usman Tariq',
    [
      { menuItemId: 'pk5', name: 'Special Chicken Biryani Double', price: 700, qty: 3 },
      { menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 5 },
      { menuItemId: 'sk1', name: 'Icecream Shake', price: 550, qty: 2 },
    ],
    'Paid',
    'Cash',
    at(10, 30),
  )

  // Same as mockData.js ORD-1036 — the recipe-deduction fixture: 2x Chicken
  // Shahi Karahi against the approved recipe above should deduct exactly
  // 1 kg Chicken + 0.2 L Cooking Oil (verified live against the frontend
  // before this backend existed — see test/inventoryFlow.test.ts).
  await seedOrder(
    6,
    'Bilal Ahmed',
    [
      { menuItemId: 'ckh1', name: 'Chicken Shahi Karahi', price: 2699, qty: 2 },
      { menuItemId: 'br2', name: 'Garlic Naan', price: 150, qty: 3 },
      { menuItemId: 'kd2', name: 'French Fries', price: 345, qty: 2 },
    ],
    'Paid',
    'Card',
    at(11, 10),
  )

  // Same as mockData.js ORD-1037.
  await seedOrder(
    9,
    'Saad Nawaz',
    [
      { menuItemId: 'bg1', name: 'Zinger Burger with Cheese', price: 1050, qty: 2 },
      { menuItemId: 'kd2', name: 'French Fries', price: 345, qty: 3 },
      { menuItemId: 'sp1', name: 'Chicken Corn Soup', price: 499, qty: 1 },
      { menuItemId: 'pk5', name: 'Special Chicken Biryani Double', price: 700, qty: 1 },
    ],
    'Paid',
    'Cash',
    at(11, 45),
  )

  console.log('Seeding Transaction...')
  async function seedTxn(type: string, category: string, description: string, amount: number, date: Date) {
    await prisma.$transaction(async (tx) => {
      const txnNumber = await nextSequence(tx, 'transaction')
      await tx.transaction.create({ data: { txnNumber, type, category, description, amount, date } })
    })
  }
  await seedTxn('income', 'Sales', 'Counter sales (month to date)', 620000, new Date(today.getFullYear(), today.getMonth(), 6))
  await seedTxn('expense', 'Rent', 'Shop rent', 120000, new Date(today.getFullYear(), today.getMonth(), 1))
  await seedTxn('expense', 'Utilities', 'Electricity & gas', 45000, new Date(today.getFullYear(), today.getMonth(), 4))
  await seedTxn('expense', 'Supplies', 'Groceries & meat', 190000, new Date(today.getFullYear(), today.getMonth(), 5))

  console.log('Seeding Advance...')
  await prisma.advance.createMany({
    data: [
      { staffId: 'S01', amount: 5000, reason: 'Personal', date: new Date(today.getFullYear(), today.getMonth(), 2), status: 'pending' },
      { staffId: 'S01', amount: 3000, reason: 'Medical', date: new Date(today.getFullYear(), today.getMonth(), 6), status: 'pending' },
      { staffId: 'S03', amount: 4000, reason: 'Advance', date: new Date(today.getFullYear(), today.getMonth(), 4), status: 'pending' },
    ],
  })

  console.log('Seed complete.')
}

// Only run + disconnect when invoked directly (`tsx prisma/seed.ts`), not when
// imported by a test that manages the prisma client's lifecycle itself.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed()
    .catch((e) => {
      console.error(e)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
