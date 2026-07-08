import {
  IconDashboard,
  IconPOS,
  IconOrders,
  IconMenuBook,
  IconInventory,
  IconAttendance,
  IconWallet,
  IconChart,
  IconReport,
  IconKitchen,
  IconReceipt,
} from '../components/Icons.jsx'

import { hasAccess } from './permissions.js'

// Role-based navigation using central permissions
export const NAV = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, pageKey: 'dashboard' },
  { to: '/pos', label: 'New Order', icon: IconPOS, pageKey: 'pos' },
  { to: '/orders', label: 'Orders', icon: IconOrders, pageKey: 'orders' },
  { to: '/menu', label: 'Menu', icon: IconMenuBook, pageKey: 'menu' },
  { to: '/inventory', label: 'Inventory', icon: IconInventory, pageKey: 'inventory' },
  { to: '/attendance', label: 'Attendance', icon: IconAttendance, pageKey: 'attendance' },
  { to: '/payroll', label: 'Payroll', icon: IconWallet, pageKey: 'payroll' },
  { to: '/accounting', label: 'Accounting', icon: IconChart, pageKey: 'accounting' },
  { to: '/reports', label: 'Reports', icon: IconReport, pageKey: 'reports' },
  { to: '/kds', label: 'Kitchen (KDS)', icon: IconKitchen, pageKey: 'kds' },
  { to: '/billing', label: 'Billing & Receipts', icon: IconReceipt, pageKey: 'billing' },
]

export const navForRole = (role) => NAV.filter((n) => hasAccess(role, n.pageKey))
