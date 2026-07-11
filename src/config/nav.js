import {
  IconDashboard,
  IconPOS,
  IconOrders,
  IconTable,
  IconMenuBook,
  IconInventory,
  IconAttendance,
  IconUsers,
  IconWallet,
  IconChart,
  IconReport,
  IconKitchen,
  IconReceipt,
} from '../components/Icons.jsx'

import { hasAccess } from './permissions.js'

// Role-based navigation using central permissions. `label` is the English
// fallback; `labelKey` resolves through i18n so the sidebar localizes.
export const NAV = [
  { to: '/', label: 'Dashboard', labelKey: 'nav.dashboard', icon: IconDashboard, pageKey: 'dashboard' },
  { to: '/pos', label: 'New Order', labelKey: 'nav.newOrder', icon: IconPOS, pageKey: 'pos' },
  { to: '/orders', label: 'Orders', labelKey: 'nav.orders', icon: IconOrders, pageKey: 'orders' },
  { to: '/tables', label: 'Tables', labelKey: 'nav.tables', icon: IconTable, pageKey: 'tables' },
  { to: '/menu', label: 'Menu', labelKey: 'nav.menu', icon: IconMenuBook, pageKey: 'menu' },
  { to: '/inventory', label: 'Inventory', labelKey: 'nav.inventory', icon: IconInventory, pageKey: 'inventory' },
  { to: '/attendance', label: 'Attendance', labelKey: 'nav.attendance', icon: IconAttendance, pageKey: 'attendance' },
  { to: '/employees', label: 'Employees', labelKey: 'nav.employees', icon: IconUsers, pageKey: 'employees' },
  { to: '/payroll', label: 'Payroll', labelKey: 'nav.payroll', icon: IconWallet, pageKey: 'payroll' },
  { to: '/accounting', label: 'Accounting', labelKey: 'nav.accounting', icon: IconChart, pageKey: 'accounting' },
  { to: '/reports', label: 'Reports', labelKey: 'nav.reports', icon: IconReport, pageKey: 'reports' },
  { to: '/kitchen', label: 'Kitchen', labelKey: 'nav.kitchen', icon: IconKitchen, pageKey: 'kitchen' },
  { to: '/kds', label: 'Kitchen (KDS)', labelKey: 'nav.kds', icon: IconKitchen, pageKey: 'kds' },
  { to: '/billing', label: 'Billing', labelKey: 'nav.billing', icon: IconReceipt, pageKey: 'billing' },
]

export const navForRole = (role) => NAV.filter((n) => hasAccess(role, n.pageKey))
