import {
  IconDashboard,
  IconPOS,
  IconOrders,
  IconAttendance,
  IconReceipt,
} from '../components/Icons.jsx'

import { hasAccess } from './permissions.js'

// Role-based navigation using central permissions
export const NAV = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, pageKey: 'dashboard' },
  { to: '/pos', label: 'New Order', icon: IconPOS, pageKey: 'pos' },
  { to: '/orders', label: 'Orders', icon: IconOrders, pageKey: 'orders' },
  { to: '/attendance', label: 'Attendance', icon: IconAttendance, pageKey: 'attendance' },
  { to: '/billing', label: 'Billing & Receipts', icon: IconReceipt, pageKey: 'billing' },
]

export const navForRole = (role) => NAV.filter((n) => hasAccess(role, n.pageKey))
