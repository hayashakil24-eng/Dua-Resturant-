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
  IconDepartments,
  IconCash,
  IconSettings,
  IconCheck,
} from '../components/Icons.jsx'

import { hasAccess } from './permissions.js'

// Sidebar section headers, in display order. Purely a visual grouping of NAV
// below — doesn't affect routing/permissions, and a group that ends up with
// zero visible items for a role (e.g. Cashier has nothing in "people") is
// simply skipped, not shown empty. `icon` is the collapsed group row's icon
// (reuses one of its children's icons rather than adding a new one per group).
export const NAV_GROUPS = [
  // Single-item today, so it renders as a flat link (see isCollapsibleGroup
  // below) — Dashboard is the landing page and stays one click away always,
  // never buried inside a dropdown.
  { id: 'dashboard', label: 'Dashboard', labelKey: 'nav.dashboard', icon: IconDashboard },
  { id: 'operations', label: 'Operations', labelKey: 'nav.groups.operations', icon: IconOrders },
  { id: 'menuKitchen', label: 'Menu & Kitchen', labelKey: 'nav.groups.menuKitchen', icon: IconMenuBook },
  { id: 'people', label: 'People', labelKey: 'nav.groups.people', icon: IconUsers },
  { id: 'finance', label: 'Finance', labelKey: 'nav.groups.finance', icon: IconChart },
  { id: 'reports', label: 'Reports', labelKey: 'nav.groups.reports', icon: IconReport },
  { id: 'settings', label: 'Settings', labelKey: 'nav.groups.settings', icon: IconSettings },
]

// Groups with exactly one item collapse to a single flat link instead of a
// dropdown — a one-item accordion (Reports today) is just friction, matching
// the reference design where leaf pages (Dashboard, Alert Inbox) sit flat and
// only multi-item sections get a chevron.
export const isCollapsibleGroup = (group) => group.items.length > 1

// Role-based navigation using central permissions. `label` is the English
// fallback; `labelKey` resolves through i18n so the sidebar localizes.
export const NAV = [
  { to: '/', label: 'Dashboard', labelKey: 'nav.dashboard', icon: IconDashboard, pageKey: 'dashboard', group: 'dashboard' },
  { to: '/pos', label: 'New Order', labelKey: 'nav.newOrder', icon: IconPOS, pageKey: 'pos', group: 'operations' },
  { to: '/orders', label: 'Orders', labelKey: 'nav.orders', icon: IconOrders, pageKey: 'orders', group: 'operations' },
  { to: '/tables', label: 'Tables', labelKey: 'nav.tables', icon: IconTable, pageKey: 'tables', group: 'operations' },
  // `fullscreen`: renders without the sidebar/Layout (unattended kitchen
  // monitor), so it must never be a role's landing page — landingForRole skips
  // it, otherwise a Kitchen-only role would be stranded with no nav (see below).
  { to: '/kds', label: 'Kitchen (KDS)', labelKey: 'nav.kds', icon: IconKitchen, pageKey: 'kds', group: 'operations', fullscreen: true },
  { to: '/menu', label: 'Menu', labelKey: 'nav.menu', icon: IconMenuBook, pageKey: 'menu', group: 'menuKitchen' },
  { to: '/departments', label: 'Departments', labelKey: 'nav.departments', icon: IconDepartments, pageKey: 'departments', group: 'menuKitchen' },
  { to: '/inventory', label: 'Inventory', labelKey: 'nav.inventory', icon: IconInventory, pageKey: 'inventory', group: 'menuKitchen' },
  { to: '/kitchen', label: 'Kitchen', labelKey: 'nav.kitchen', icon: IconKitchen, pageKey: 'kitchen', group: 'menuKitchen' },
  { to: '/attendance', label: 'Attendance', labelKey: 'nav.attendance', icon: IconAttendance, pageKey: 'attendance', group: 'people' },
  { to: '/employees', label: 'Employees', labelKey: 'nav.employees', icon: IconUsers, pageKey: 'employees', group: 'people' },
  { to: '/approvals', label: 'Approvals', labelKey: 'nav.approvals', icon: IconCheck, pageKey: 'staffApproval', group: 'people' },
  { to: '/payroll', label: 'Payroll', labelKey: 'nav.payroll', icon: IconWallet, pageKey: 'payroll', group: 'people' },
  { to: '/accounting', label: 'Accounting', labelKey: 'nav.accounting', icon: IconChart, pageKey: 'accounting', group: 'finance' },
  { to: '/receivables', label: 'Receivables', labelKey: 'nav.receivables', icon: IconWallet, pageKey: 'receivables', group: 'finance' },
  { to: '/handovers', label: 'Handover Approvals', labelKey: 'nav.handovers', icon: IconCash, pageKey: 'handovers', group: 'finance' },
  { to: '/billing', label: 'Billing', labelKey: 'nav.billing', icon: IconReceipt, pageKey: 'billing', group: 'finance' },
  { to: '/reports', label: 'Reports', labelKey: 'nav.reports', icon: IconReport, pageKey: 'reports', group: 'reports' },
  { to: '/closing', label: 'Day Closing', labelKey: 'nav.closing', icon: IconReceipt, pageKey: 'closing', group: 'reports' },
  { to: '/settings', label: 'Settings', labelKey: 'nav.settings', icon: IconSettings, pageKey: 'settings', group: 'settings' },
]

export const navForRole = (role) => NAV.filter((n) => hasAccess(role, n.pageKey))

// The page a role lands on after login (and when redirected off a disallowed
// route). It's the first allowed nav item that ISN'T fullscreen — a fullscreen
// page (KDS) has no sidebar, so landing there leaves the role with no way to
// navigate anywhere else (this stranded the Kitchen role on the KDS, hiding the
// recipe-creation page). Falls back to the first allowed item, then /login.
export const landingForRole = (role) => {
  const items = navForRole(role)
  return (items.find((n) => !n.fullscreen) || items[0])?.to || '/login'
}

// Same as navForRole, but bucketed into NAV_GROUPS for the sidebar. Groups
// with no visible items for this role are omitted entirely.
export const groupedNavForRole = (role) => {
  const items = navForRole(role)
  return NAV_GROUPS
    .map((g) => ({ ...g, items: items.filter((n) => n.group === g.id) }))
    .filter((g) => g.items.length > 0)
}
