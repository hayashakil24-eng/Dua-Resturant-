// Page-level keys (dashboard, pos, inventory…) gate route access and the edit
// controls on each page. The keys below the divider are finer-grained
// separation-of-duties rules that intentionally split control between roles to
// reduce collusion risk:
//   • recipeApproval    — only Admin (owner-level) may approve a recipe, because
//                         a bad recipe silently mis-deducts on every order.
//   • recipeCreate      — kitchen staff author recipes (pending approval); only
//                         the Kitchen role has it.
//   • kitchen           — page access to the Kitchen dashboard (/kitchen).
//   • inventoryAdd      — only Manager may add new stock / purchases.
//   • inventoryDirectEdit — Admin & Manager may adjust existing quantities for
//                         corrections (Cashier cannot).
//   • inventoryCreate   — only Admin may create a brand-new inventory item
//                         directly (proactively), independent of the Chef's
//                         ingredient-request approval flow. Manager cannot.
//   • wastageReport / wastageApproval — reporting is broad; approval stays with
//                         Manager + Admin. (No wastage feature is built yet;
//                         these are declarative policy for when it is.)
export const PERMISSIONS = {
  Admin: {
    dashboard: 'full',
    pos: 'full',
    orders: 'edit',
    orderCancel: 'full',
    discount: 'full',
    tables: 'full',
    menu: 'full',
    inventory: 'full',
    attendance: 'full',
    employees: 'full',
    payroll: 'full',
    accounting: 'full',
    reports: 'full',
    kds: 'full',
    billing: 'full',
    attendanceOverride: 'full',
    kitchen: 'view', // Admin can view the Kitchen dashboard / recipes
    tableAdd: 'full', // add/manage tables (Admin + Manager only)
    categoryAdd: 'full', // add free-text menu categories (Admin + Manager only)
    mostOrderedManage: 'full', // curate the shared POS "Most Ordered" list
    // Separation of duties
    recipeApproval: 'full', // ONLY Admin approves recipes
    recipeCreate: 'none',
    inventoryAdd: 'none', // Admin does NOT add new stock (Manager only)
    inventoryDirectEdit: 'full', // Admin may edit existing stock for corrections
    inventoryCreate: 'full', // ONLY Admin creates brand-new inventory items
    wastageReport: 'full',
    wastageApproval: 'full',
  },
  Manager: {
    dashboard: 'full',
    pos: 'hidden',
    orders: 'view',
    orderCancel: 'none', // Only Admin may cancel bills; Manager is view-only
    discount: 'full',
    tables: 'full',
    menu: 'hidden',
    inventory: 'full',
    attendance: 'full',
    employees: 'full',
    payroll: 'full',
    accounting: 'full',
    reports: 'full',
    kds: 'full',
    billing: 'view',
    attendanceOverride: 'none',
    kitchen: 'view', // Manager can view the Kitchen dashboard / recipes
    tableAdd: 'full', // add/manage tables
    categoryAdd: 'full', // add free-text menu categories
    mostOrderedManage: 'full', // curate the shared POS "Most Ordered" list
    // Separation of duties
    recipeApproval: 'none', // Manager CANNOT approve recipes (collusion risk)
    recipeCreate: 'none',
    inventoryAdd: 'full', // ONLY Manager adds new stock / purchases
    inventoryDirectEdit: 'full', // Manager may adjust existing stock too
    inventoryCreate: 'none', // Manager does NOT create new items (Admin only)
    wastageReport: 'full',
    wastageApproval: 'full',
  },
  // Kitchen staff: recipe authors only. They land on their own /kitchen page and
  // cannot see finance/ops pages. Everything else is 'hidden' so navForRole()
  // returns just the Kitchen dashboard as their home.
  Kitchen: {
    dashboard: 'hidden',
    pos: 'hidden',
    orders: 'hidden',
    orderCancel: 'none',
    discount: 'none',
    tables: 'hidden',
    menu: 'hidden',
    inventory: 'hidden',
    attendance: 'hidden',
    employees: 'hidden',
    payroll: 'hidden',
    accounting: 'hidden',
    reports: 'hidden',
    kds: 'full', // kitchen staff can watch the live order display too
    billing: 'hidden',
    attendanceOverride: 'none',
    kitchen: 'full', // owns the Kitchen dashboard + recipe creation
    tableAdd: 'none',
    categoryAdd: 'none',
    mostOrderedManage: 'none', // Kitchen doesn't use the POS
    // Separation of duties
    recipeApproval: 'none',
    recipeCreate: 'full', // Kitchen creates recipes (pending Admin approval)
    inventoryAdd: 'none',
    inventoryDirectEdit: 'none',
    inventoryCreate: 'none',
    wastageReport: 'full',
    wastageApproval: 'none',
  },
  Cashier: {
    dashboard: 'hidden',
    pos: 'full',
    orders: 'edit',
    orderCancel: 'none',
    discount: 'none',
    tables: 'full',
    menu: 'hidden',
    inventory: 'hidden',
    attendance: 'hidden',
    employees: 'hidden',
    payroll: 'hidden',
    accounting: 'hidden',
    reports: 'hidden',
    kds: 'hidden',
    billing: 'create',
    attendanceOverride: 'none',
    kitchen: 'hidden',
    tableAdd: 'none', // Cashier can use tables to take orders, but not add them
    categoryAdd: 'none',
    mostOrderedManage: 'full', // Cashier CAN curate the shared "Most Ordered" list
    // Separation of duties
    recipeApproval: 'none',
    recipeCreate: 'none',
    inventoryAdd: 'none',
    inventoryDirectEdit: 'none',
    inventoryCreate: 'none',
    wastageReport: 'none',
    wastageApproval: 'none',
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
