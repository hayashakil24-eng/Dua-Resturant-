import {
  IconDashboard,
  IconPOS,
  IconOrders,
  IconAttendance,
  IconReceipt,
} from '../components/Icons.jsx'

// Role-based navigation. `roles` lists which roles may see the item.
export const NAV = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, roles: ['Admin', 'Manager', 'Cashier'] },
  { to: '/pos', label: 'New Order', icon: IconPOS, roles: ['Admin', 'Manager', 'Cashier'] },
  { to: '/orders', label: 'Orders', icon: IconOrders, roles: ['Admin', 'Manager', 'Cashier'] },
  { to: '/attendance', label: 'Attendance', icon: IconAttendance, roles: ['Admin', 'Manager'] },
  { to: '/billing', label: 'Billing & Receipts', icon: IconReceipt, roles: ['Admin', 'Cashier'] },
]

export const navForRole = (role) => NAV.filter((n) => n.roles.includes(role))
