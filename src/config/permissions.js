export const PERMISSIONS = {
  Admin: {
    dashboard: 'full',
    pos: 'full',
    orders: 'edit',
    inventory: 'full',
    attendance: 'full',
    payroll: 'full',
    accounting: 'full',
    reports: 'full',
    kds: 'full',
    billing: 'full',
  },
  Manager: {
    dashboard: 'full',
    pos: 'hidden',
    orders: 'view',
    inventory: 'full',
    attendance: 'full',
    payroll: 'hidden',
    accounting: 'full',
    reports: 'full',
    kds: 'full',
    billing: 'view',
  },
  Cashier: {
    dashboard: 'hidden',
    pos: 'full',
    orders: 'edit',
    inventory: 'hidden',
    attendance: 'hidden',
    payroll: 'hidden',
    accounting: 'hidden',
    reports: 'hidden',
    kds: 'full',
    billing: 'create',
  },
}

export function hasAccess(role, pageKey) {
  const perm = PERMISSIONS[role]?.[pageKey]
  return perm && perm !== 'hidden'
}

export function getAccessLevel(role, pageKey) {
  return PERMISSIONS[role]?.[pageKey] || 'hidden'
}

export function canModify(role, pageKey) {
  const level = getAccessLevel(role, pageKey)
  return level === 'full' || level === 'edit' || level === 'create'
}
