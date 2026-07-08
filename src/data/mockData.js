// ---------------------------------------------------------------------------
// Dua Restaurant — mock data (frontend only, no backend)
// ---------------------------------------------------------------------------

export const ROLES = ['Admin', 'Manager', 'Cashier']

export const STAFF = [
  { id: 'S01', name: 'Ali Raza', role: 'Manager', shift: 'Morning', phone: '0300-1122334', baseSalary: 60000 },
  { id: 'S02', name: 'Hamza Khan', role: 'Cashier', shift: 'Morning', phone: '0301-2233445', baseSalary: 38000 },
  { id: 'S03', name: 'Bilal Ahmed', role: 'Waiter', shift: 'Evening', phone: '0302-3344556', baseSalary: 28000 },
  { id: 'S04', name: 'Usman Tariq', role: 'Waiter', shift: 'Morning', phone: '0303-4455667', baseSalary: 28000 },
  { id: 'S05', name: 'Zain Malik', role: 'Waiter', shift: 'Evening', phone: '0304-5566778', baseSalary: 27000 },
  { id: 'S06', name: 'Fahad Iqbal', role: 'Chef', shift: 'Morning', phone: '0305-6677889', baseSalary: 55000 },
  { id: 'S07', name: 'Saad Nawaz', role: 'Waiter', shift: 'Evening', phone: '0306-7788990', baseSalary: 26000 },
  { id: 'S08', name: 'Kamran Shah', role: 'Cashier', shift: 'Evening', phone: '0307-8899001', baseSalary: 36000 },
]

export const WAITERS = STAFF.filter((s) => s.role === 'Waiter')

export const TABLES = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  seats: [2, 4, 6][i % 3],
}))

export const MENU_CATEGORIES = ['All', 'Starters', 'BBQ & Grill', 'Main Course', 'Beverages', 'Desserts']

export const MENU = [
  { id: 'M01', name: 'Chicken Malai Boti', category: 'BBQ & Grill', price: 850, emoji: '🍢', image: '/chicken-malai-boti.jfif' },
  { id: 'M02', name: 'Seekh Kebab', category: 'BBQ & Grill', price: 650, emoji: '🥩', image: '/seekh-kabab.jfif' },
  { id: 'M03', name: 'Beef Ribs', category: 'BBQ & Grill', price: 1450, emoji: '🍖', image: '/ribs.jfif' },
  { id: 'M04', name: 'Chicken Karahi', category: 'Main Course', price: 1650, emoji: '🍛', image: '/chicken karahi.jfif' },
  { id: 'M05', name: 'Mutton Biryani', category: 'Main Course', price: 950, emoji: '🍚', image: '/briyani picture.jpg' },
  { id: 'M06', name: 'Butter Chicken', category: 'Main Course', price: 1250, emoji: '🍗', image: '/butter chicken.jfif' },
  { id: 'M07', name: 'Daal Makhani', category: 'Main Course', price: 550, emoji: '🥘', image: '/Daal-makhni.jfif' },
  { id: 'M08', name: 'Chicken Samosa', category: 'Starters', price: 120, emoji: '🥟', image: '/chickend-samoosa.jfif' },
  { id: 'M09', name: 'Fries', category: 'Starters', price: 350, emoji: '🍟', image: '/Fries.jpeg' },
  { id: 'M10', name: 'Chicken Soup', category: 'Starters', price: 400, emoji: '🍲', image: '/Soups.jfif' },
  { id: 'M11', name: 'Garlic Naan', category: 'Main Course', price: 90, emoji: '🫓', image: '/naan.jfif' },
  { id: 'M12', name: 'Fresh Lime', category: 'Beverages', price: 250, emoji: '🍋', image: '/fresh lime.jfif' },
  { id: 'M13', name: 'Kashmiri Chai', category: 'Beverages', price: 300, emoji: '☕', image: '/kashmiri chaiii.jfif' },
  { id: 'M14', name: 'Soft Drink', category: 'Beverages', price: 150, emoji: '🥤', image: '/softdrinks.jfif' },
  { id: 'M15', name: 'Mineral Water', category: 'Beverages', price: 80, emoji: '💧', image: '/mineral water.jfif' },
  { id: 'M16', name: 'Gulab Jamun', category: 'Desserts', price: 320, emoji: '🍡', image: '/gulab jamun.jfif' },
  { id: 'M17', name: 'Kheer', category: 'Desserts', price: 280, emoji: '🍮', image: '/kheer.jfif' },
  { id: 'M18', name: 'Ice Cream', category: 'Desserts', price: 220, emoji: '🍨', image: '/ice cream.jfif' },
]

// ---------------------------------------------------------------------------
// Kitchen inventory — stock levels for low-stock alerts (frontend only)
//   low stock  => stock <= threshold
// ---------------------------------------------------------------------------
export const INVENTORY = [
  { id: 'INV01', name: 'Flour (Atta)', category: 'Grains', stock: 2, unit: 'kg', threshold: 10 },
  { id: 'INV02', name: 'Cooking Oil', category: 'Pantry', stock: 1, unit: 'L', threshold: 8 },
  { id: 'INV03', name: 'Chicken', category: 'Meat', stock: 3, unit: 'kg', threshold: 12 },
  { id: 'INV04', name: 'Mutton', category: 'Meat', stock: 18, unit: 'kg', threshold: 10 },
  { id: 'INV05', name: 'Beef', category: 'Meat', stock: 22, unit: 'kg', threshold: 10 },
  { id: 'INV06', name: 'Basmati Rice', category: 'Grains', stock: 40, unit: 'kg', threshold: 15 },
  { id: 'INV07', name: 'Tomatoes', category: 'Vegetables', stock: 6, unit: 'kg', threshold: 8 },
  { id: 'INV08', name: 'Onions', category: 'Vegetables', stock: 30, unit: 'kg', threshold: 10 },
  { id: 'INV09', name: 'Yogurt', category: 'Dairy', stock: 9, unit: 'L', threshold: 6 },
  { id: 'INV10', name: 'Milk', category: 'Dairy', stock: 4, unit: 'L', threshold: 10 },
  { id: 'INV11', name: 'Tea Leaves', category: 'Beverages', stock: 3, unit: 'kg', threshold: 5 },
  { id: 'INV12', name: 'Sugar', category: 'Pantry', stock: 25, unit: 'kg', threshold: 10 },
  { id: 'INV13', name: 'Spice Mix', category: 'Pantry', stock: 14, unit: 'packs', threshold: 5 },
  { id: 'INV14', name: 'Soft Drinks', category: 'Beverages', stock: 18, unit: 'pcs', threshold: 20 },
  { id: 'INV15', name: 'Mineral Water', category: 'Beverages', stock: 40, unit: 'pcs', threshold: 24 },
]

// ---------------------------------------------------------------------------
// Recipe map — approximate ingredient usage per one unit of a menu item.
// Ingredient names match INVENTORY above, so Reports can estimate stock used
// from the day's/month's orders. Frontend estimate only (no auto-deduction).
// ---------------------------------------------------------------------------
export const RECIPE_MAP = {
  M01: [{ name: 'Chicken', qty: 0.25, unit: 'kg' }],
  M02: [{ name: 'Beef', qty: 0.2, unit: 'kg' }],
  M03: [{ name: 'Beef', qty: 0.4, unit: 'kg' }],
  M04: [
    { name: 'Chicken', qty: 0.5, unit: 'kg' },
    { name: 'Tomatoes', qty: 0.15, unit: 'kg' },
    { name: 'Onions', qty: 0.1, unit: 'kg' },
  ],
  M05: [
    { name: 'Basmati Rice', qty: 0.2, unit: 'kg' },
    { name: 'Mutton', qty: 0.2, unit: 'kg' },
  ],
  M06: [
    { name: 'Chicken', qty: 0.35, unit: 'kg' },
    { name: 'Yogurt', qty: 0.05, unit: 'L' },
  ],
  M07: [{ name: 'Onions', qty: 0.05, unit: 'kg' }],
  M08: [
    { name: 'Chicken', qty: 0.05, unit: 'kg' },
    { name: 'Flour (Atta)', qty: 0.05, unit: 'kg' },
  ],
  M09: [{ name: 'Cooking Oil', qty: 0.1, unit: 'L' }],
  M10: [{ name: 'Chicken', qty: 0.1, unit: 'kg' }],
  M11: [{ name: 'Flour (Atta)', qty: 0.12, unit: 'kg' }],
  M12: [{ name: 'Sugar', qty: 0.02, unit: 'kg' }],
  M13: [
    { name: 'Milk', qty: 0.15, unit: 'L' },
    { name: 'Tea Leaves', qty: 0.01, unit: 'kg' },
    { name: 'Sugar', qty: 0.02, unit: 'kg' },
  ],
  M14: [{ name: 'Soft Drinks', qty: 1, unit: 'pcs' }],
  M15: [{ name: 'Mineral Water', qty: 1, unit: 'pcs' }],
  M16: [
    { name: 'Sugar', qty: 0.05, unit: 'kg' },
    { name: 'Milk', qty: 0.05, unit: 'L' },
  ],
  M17: [
    { name: 'Milk', qty: 0.2, unit: 'L' },
    { name: 'Sugar', qty: 0.05, unit: 'kg' },
    { name: 'Basmati Rice', qty: 0.03, unit: 'kg' },
  ],
  M18: [
    { name: 'Milk', qty: 0.1, unit: 'L' },
    { name: 'Sugar', qty: 0.03, unit: 'kg' },
  ],
}

const today = new Date()
const t = (h, m) => {
  const d = new Date(today)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

export const INITIAL_ORDERS = [
  {
    id: 'ORD-1041',
    table: 5,
    waiter: 'Bilal Ahmed',
    items: [
      { id: 'M04', name: 'Chicken Karahi', price: 1650, qty: 1 },
      { id: 'M11', name: 'Garlic Naan', price: 90, qty: 4 },
      { id: 'M13', name: 'Kashmiri Chai', price: 300, qty: 2 },
    ],
    payment: 'Paid',
    method: 'Card',
    kitchen: 'Ready',
    createdAt: t(12, 15),
  },
  {
    id: 'ORD-1042',
    table: 2,
    waiter: 'Usman Tariq',
    items: [
      { id: 'M05', name: 'Mutton Biryani', price: 950, qty: 2 },
      { id: 'M12', name: 'Fresh Lime', price: 250, qty: 2 },
    ],
    payment: 'Unpaid',
    method: '—',
    kitchen: 'Pending',
    createdAt: t(13, 5),
  },
  {
    id: 'ORD-1043',
    table: 8,
    waiter: 'Zain Malik',
    items: [
      { id: 'M01', name: 'Chicken Malai Boti', price: 850, qty: 2 },
      { id: 'M02', name: 'Seekh Kebab', price: 650, qty: 1 },
      { id: 'M09', name: 'Fries', price: 350, qty: 1 },
      { id: 'M14', name: 'Soft Drink', price: 150, qty: 3 },
    ],
    payment: 'Paid',
    method: 'Cash',
    kitchen: 'Pending',
    createdAt: t(13, 40),
  },
  {
    id: 'ORD-1044',
    table: 11,
    waiter: 'Saad Nawaz',
    items: [
      { id: 'M06', name: 'Butter Chicken', price: 1250, qty: 1 },
      { id: 'M11', name: 'Garlic Naan', price: 90, qty: 3 },
      { id: 'M16', name: 'Gulab Jamun', price: 320, qty: 2 },
    ],
    payment: 'Paid',
    method: 'Card',
    kitchen: 'Ready',
    createdAt: t(14, 20),
  },
  {
    id: 'ORD-1045',
    table: 3,
    waiter: 'Bilal Ahmed',
    items: [
      { id: 'M03', name: 'Beef Ribs', price: 1450, qty: 1 },
      { id: 'M15', name: 'Mineral Water', price: 80, qty: 2 },
    ],
    payment: 'Unpaid',
    method: '—',
    kitchen: 'Pending',
    createdAt: t(14, 55),
  },
]

// Attendance status per staff for today
export const INITIAL_ATTENDANCE = {
  S01: { checkIn: t(9, 2), checkOut: null, status: 'Present' },
  S02: { checkIn: t(9, 15), checkOut: null, status: 'Present' },
  S03: { checkIn: t(16, 0), checkOut: null, status: 'Present' },
  S04: { checkIn: t(8, 58), checkOut: t(15, 0), status: 'Checked Out' },
  S05: { checkIn: null, checkOut: null, status: 'Absent' },
  S06: { checkIn: t(9, 30), checkOut: null, status: 'Present' },
  S07: { checkIn: t(16, 10), checkOut: null, status: 'Late' },
  S08: { checkIn: null, checkOut: null, status: 'Absent' },
}

// ---------------------------------------------------------------------------
// Accounting ledger — income & expense transactions (frontend only).
// Seeded across the last 6 months so the P&L chart has a trend. Staff payroll
// is NOT seeded here — it's pulled live from utils/payroll.js so Accounting,
// Payroll and the Dashboard always agree.
// ---------------------------------------------------------------------------
export const INCOME_CATEGORIES = ['Sales', 'Catering', 'Other']
export const EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Supplies',
  'Gas',
  'Maintenance',
  'Marketing',
  'Other',
]

const _now = new Date()
const txnDate = (monthsAgo, day) =>
  new Date(_now.getFullYear(), _now.getMonth() - monthsAgo, day).toISOString()

export const INITIAL_TRANSACTIONS = (() => {
  const list = []
  let id = 100
  for (let m = 5; m >= 0; m--) {
    const current = m === 0
    const saleDay = current ? Math.min(_now.getDate(), 6) : 15
    const supplyDay = current ? Math.min(_now.getDate(), 5) : 10

    list.push({
      id: `TXN-${id++}`,
      type: 'income',
      category: 'Sales',
      description: current ? 'Counter sales (month to date)' : 'Monthly counter sales',
      amount: current ? 620000 : 760000 + (5 - m) * 18000,
      date: txnDate(m, saleDay),
    })
    if (!current && m % 2 === 0) {
      list.push({
        id: `TXN-${id++}`,
        type: 'income',
        category: 'Catering',
        description: 'Event catering order',
        amount: 150000,
        date: txnDate(m, 20),
      })
    }
    list.push({
      id: `TXN-${id++}`,
      type: 'expense',
      category: 'Rent',
      description: 'Shop rent',
      amount: 120000,
      date: txnDate(m, 1),
    })
    list.push({
      id: `TXN-${id++}`,
      type: 'expense',
      category: 'Utilities',
      description: 'Electricity & gas',
      amount: 45000 + m * 1500,
      date: txnDate(m, 4),
    })
    list.push({
      id: `TXN-${id++}`,
      type: 'expense',
      category: 'Supplies',
      description: 'Groceries & meat',
      amount: 190000 + (5 - m) * 8000,
      date: txnDate(m, supplyDay),
    })
  }
  return list
})()

export const TAX_RATE = 0.05 // 5% GST
export const CURRENCY = 'Rs.'
