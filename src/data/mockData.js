// ---------------------------------------------------------------------------
// Dua Restaurant — mock data (frontend only, no backend)
// ---------------------------------------------------------------------------

export const ROLES = ['Admin', 'Manager', 'Cashier']

export const STAFF = [
  { id: 'S01', name: 'Ali Raza', role: 'Manager', shift: 'Morning', phone: '0300-1122334' },
  { id: 'S02', name: 'Hamza Khan', role: 'Cashier', shift: 'Morning', phone: '0301-2233445' },
  { id: 'S03', name: 'Bilal Ahmed', role: 'Waiter', shift: 'Evening', phone: '0302-3344556' },
  { id: 'S04', name: 'Usman Tariq', role: 'Waiter', shift: 'Morning', phone: '0303-4455667' },
  { id: 'S05', name: 'Zain Malik', role: 'Waiter', shift: 'Evening', phone: '0304-5566778' },
  { id: 'S06', name: 'Fahad Iqbal', role: 'Chef', shift: 'Morning', phone: '0305-6677889' },
  { id: 'S07', name: 'Saad Nawaz', role: 'Waiter', shift: 'Evening', phone: '0306-7788990' },
  { id: 'S08', name: 'Kamran Shah', role: 'Cashier', shift: 'Evening', phone: '0307-8899001' },
]

export const WAITERS = STAFF.filter((s) => s.role === 'Waiter')

export const TABLES = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  seats: [2, 4, 6][i % 3],
}))

export const MENU_CATEGORIES = ['All', 'Starters', 'BBQ & Grill', 'Main Course', 'Beverages', 'Desserts']

export const MENU = [
  { id: 'M01', name: 'Chicken Malai Boti', category: 'BBQ & Grill', price: 850, emoji: '🍢', image: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=500&auto=format&fit=crop&q=80' },
  { id: 'M02', name: 'Seekh Kebab', category: 'BBQ & Grill', price: 650, emoji: '🥩', image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=500&auto=format&fit=crop&q=80' },
  { id: 'M03', name: 'Beef Ribs', category: 'BBQ & Grill', price: 1450, emoji: '🍖', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80' },
  { id: 'M04', name: 'Chicken Karahi', category: 'Main Course', price: 1650, emoji: '🍛', image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=500&auto=format&fit=crop&q=80' },
  { id: 'M05', name: 'Mutton Biryani', category: 'Main Course', price: 950, emoji: '🍚', image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80' },
  { id: 'M06', name: 'Butter Chicken', category: 'Main Course', price: 1250, emoji: '🍗', image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500&auto=format&fit=crop&q=80' },
  { id: 'M07', name: 'Daal Makhani', category: 'Main Course', price: 550, emoji: '🥘', image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80' },
  { id: 'M08', name: 'Chicken Samosa', category: 'Starters', price: 120, emoji: '🥟', image: 'https://images.unsplash.com/photo-1585938338392-50a5d222902c?w=500&auto=format&fit=crop&q=80' },
  { id: 'M09', name: 'Fries', category: 'Starters', price: 350, emoji: '🍟', image: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=500&auto=format&fit=crop&q=80' },
  { id: 'M10', name: 'Chicken Soup', category: 'Starters', price: 400, emoji: '🍲', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=500&auto=format&fit=crop&q=80' },
  { id: 'M11', name: 'Garlic Naan', category: 'Main Course', price: 90, emoji: '🫓', image: 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=500&auto=format&fit=crop&q=80' },
  { id: 'M12', name: 'Fresh Lime', category: 'Beverages', price: 250, emoji: '🍋', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=80' },
  { id: 'M13', name: 'Kashmiri Chai', category: 'Beverages', price: 300, emoji: '☕', image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80' },
  { id: 'M14', name: 'Soft Drink', category: 'Beverages', price: 150, emoji: '🥤', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80' },
  { id: 'M15', name: 'Mineral Water', category: 'Beverages', price: 80, emoji: '💧', image: 'https://images.unsplash.com/photo-1608885898957-a599fb18ec3f?w=500&auto=format&fit=crop&q=80' },
  { id: 'M16', name: 'Gulab Jamun', category: 'Desserts', price: 320, emoji: '🍡', image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80' },
  { id: 'M17', name: 'Kheer', category: 'Desserts', price: 280, emoji: '🍮', image: 'https://images.unsplash.com/photo-1517433367423-c7e5b0f35086?w=500&auto=format&fit=crop&q=80' },
  { id: 'M18', name: 'Ice Cream', category: 'Desserts', price: 220, emoji: '🍨', image: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=500&auto=format&fit=crop&q=80' },
]

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

export const TAX_RATE = 0.05 // 5% GST
export const CURRENCY = 'Rs.'
