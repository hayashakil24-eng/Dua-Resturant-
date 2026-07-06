export const PERMISSIONS = {
  Admin: {
    dashboard: 'full',
    pos: 'full',
    orders: 'edit',
    attendance: 'full',
    billing: 'full',
  },
  Manager: {
    dashboard: 'full',
    pos: 'hidden',
    orders: 'view',
    attendance: 'full',
    billing: 'view',
  },
  Cashier: {
    dashboard: 'hidden',
    pos: 'full',
    orders: 'edit',
    attendance: 'hidden',
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
