// Page-level keys (dashboard, pos, inventory…) gate route access and the edit
// controls on each page. The keys below the divider are finer-grained
// separation-of-duties rules that intentionally split control between roles to
// reduce collusion risk:
//   • recipeApproval    — only Admin (owner-level) may approve a recipe, because
//                         a bad recipe silently mis-deducts on every order.
//   • recipeCreate      — kitchen staff author recipes (pending approval); only
//                         the Kitchen role has it.
//   • kitchen           — page access to the Kitchen dashboard (/kitchen).
//   • inventoryAdd      — Admin & Manager may add new stock / purchases. This
//                         was Manager-only as an anti-collusion split; the
//                         client asked for Buy Stock on the Admin table too, so
//                         the split no longer holds — purchases are still fully
//                         audited, which is what the trail now relies on.
//   • inventoryDirectEdit — Admin & Manager may adjust existing quantities for
//                         corrections (Cashier cannot).
//   • inventoryCreate   — Admin & Manager may create a brand-new inventory item
//                         directly (proactively), independent of the Chef's
//                         ingredient-request approval flow. Cashier/Kitchen not.
//   • wastageReport / wastageApproval — reporting is broad; approval stays with
//                         Manager + Admin. (No wastage feature is built yet;
//                         these are declarative policy for when it is.)
//   • drawer            — run a cash drawer (start/pause/end a shift, and the
//                         cashier-side handover that empties it). Deliberately
//                         NOT implied by 'pos'/'billing': a Manager punches and
//                         settles orders but must never run a drawer, because
//                         they are the one who RECEIVES handovers, and someone
//                         who both hands cash over and signs for it defeats the
//                         whole chain.
//   • handovers         — accept/reject a cash handover. Held by Admin AND
//                         Manager, but each may only act on handovers
//                         addressed to their own role (enforced in
//                         shifts.service.ts, not by this table) — the person
//                         taking the cash is the person who signs for it.
//   • handoverForward   — only Manager hands collected cash onward. Cash flows
//                         Cashier → Manager/Admin → Admin, so Admin is the
//                         final destination and has nowhere to forward to.
//   • staffApproval     — only Admin reviews self-signup requests and assigns
//                         the new account's role. Also doubles as the
//                         Approvals tab's nav pageKey (unlike recipeApproval,
//                         a pure action-gate never used for nav), so every
//                         non-Admin role uses 'hidden' here rather than
//                         'none' — hasAccess only blocks on 'hidden'.
//   • orderItemCancel   — cancel ONE line off an otherwise-running bill (e.g.
//                         the customer sends back a dish). Deliberately
//                         SEPARATE from orderCancel (which voids the whole
//                         bill and is Admin-only): the cashier standing at the
//                         table can pull a single item themselves without
//                         escalating to Admin — Cashier gets 'edit' here even
//                         though orderCancel is 'none' for that role. Still
//                         fully server-checked + audited, same as any mutator.
export const PERMISSIONS = {
  Admin: {
    dashboard: 'full',
    pos: 'full',
    orders: 'edit',
    orderCancel: 'full',
    orderItemCancel: 'full',
    discount: 'full',
    tables: 'full',
    menu: 'full',
    inventory: 'full',
    attendance: 'full',
    employees: 'full',
    payroll: 'full',
    accounting: 'full',
    reports: 'full',
    closing: 'full', // end-of-day closing report (Admin/Manager)
    receivables: 'full', // credit accounts — view & settle
    departments: 'full', // create/edit counters + assign items to them
    drawer: 'full', // may run a cash drawer
    handovers: 'full', // review/accept/reject handovers addressed to Admin
    handoverForward: 'none', // Admin is the final destination — nowhere to forward to
    orderComplimentary: 'full', // mark an order free / on-the-house
    kds: 'full',
    billing: 'full',
    settings: 'full', // Admin-only: app settings (GST toggle, etc.)
    attendanceOverride: 'full',
    kitchen: 'view', // Admin can view the Kitchen dashboard / recipes
    tableAdd: 'full', // add/manage tables (Admin + Manager only)
    categoryAdd: 'full', // add free-text menu categories (Admin + Manager only)
    mostOrderedManage: 'full', // curate the shared POS "Most Ordered" list
    // Separation of duties
    recipeApproval: 'full', // ONLY Admin approves recipes
    recipeCreate: 'none',
    inventoryAdd: 'full', // Admin records purchases too (client asked for Buy Stock on the Admin table)
    inventoryDirectEdit: 'full', // Admin may edit existing stock for corrections
    inventoryCreate: 'full', // ONLY Admin creates brand-new inventory items
    wastageReport: 'full',
    wastageApproval: 'full',
    staffApproval: 'full', // ONLY Admin approves staff signups
  },
  Manager: {
    dashboard: 'full',
    pos: 'full', // Manager may punch orders (no drawer — see `drawer`)
    orders: 'view',
    orderCancel: 'none', // Only Admin may cancel bills; Manager is view-only
    orderItemCancel: 'full', // Manager may still pull a single line off a running bill
    discount: 'full',
    tables: 'full',
    menu: 'full',
    inventory: 'full',
    attendance: 'full',
    employees: 'full',
    payroll: 'full',
    accounting: 'full',
    reports: 'full',
    closing: 'full', // end-of-day closing report (Admin/Manager)
    receivables: 'full', // Manager may view & settle credit accounts
    departments: 'full', // Manager may create counters + assign items too
    drawer: 'none', // Manager RECEIVES cash; running a drawer too would defeat the chain
    handovers: 'full', // Manager may review/accept/reject handovers addressed to Manager
    handoverForward: 'full', // ONLY Manager forwards collected cash up to Admin
    orderComplimentary: 'full', // Manager may mark an order free / on-the-house
    kds: 'full',
    billing: 'create', // may settle a bill they punched
    settings: 'hidden', // Only Admin controls app settings
    attendanceOverride: 'full', // Manager may also use the emergency manual override (biometric machine failure)
    kitchen: 'view', // Manager can view the Kitchen dashboard / recipes
    tableAdd: 'full', // add/manage tables
    categoryAdd: 'full', // add free-text menu categories
    mostOrderedManage: 'full', // curate the shared POS "Most Ordered" list
    // Separation of duties
    recipeApproval: 'none', // Manager CANNOT approve recipes (collusion risk)
    recipeCreate: 'none',
    inventoryAdd: 'full', // Manager adds new stock / purchases
    inventoryDirectEdit: 'full', // Manager may adjust existing stock too
    inventoryCreate: 'full', // Manager may also create new inventory items
    wastageReport: 'full',
    wastageApproval: 'full',
    staffApproval: 'hidden', // Manager CANNOT approve staff signups (collusion risk)
  },
  // Kitchen staff: recipe authors only. They land on their own /kitchen page and
  // cannot see finance/ops pages. Everything else is 'hidden' so navForRole()
  // returns just the Kitchen dashboard as their home.
  Kitchen: {
    dashboard: 'hidden',
    pos: 'hidden',
    orders: 'hidden',
    orderCancel: 'none',
    orderItemCancel: 'none',
    discount: 'none',
    tables: 'hidden',
    menu: 'hidden',
    inventory: 'hidden',
    attendance: 'hidden',
    employees: 'hidden',
    payroll: 'hidden',
    accounting: 'hidden',
    reports: 'hidden',
    closing: 'hidden',
    receivables: 'hidden',
    departments: 'hidden', // Kitchen doesn't configure counters
    drawer: 'none',
    handovers: 'hidden',
    handoverForward: 'none',
    orderComplimentary: 'none',
    kds: 'full', // kitchen staff can watch the live order display too
    billing: 'hidden',
    settings: 'hidden',
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
    staffApproval: 'hidden',
  },
  Cashier: {
    dashboard: 'hidden',
    pos: 'full',
    orders: 'edit',
    orderCancel: 'none',
    orderItemCancel: 'edit', // Cashier CAN pull a single item off a running bill (see the divider comment above)
    // Capped, not unlimited like Admin/Manager's 'full' — the actual ceiling
    // (Settings' Max Cashier Discount %) is enforced in orders.service.ts's
    // applyDiscount, not by this table. 'edit' just grants UI/route access.
    discount: 'edit',
    tables: 'full',
    menu: 'hidden',
    inventory: 'hidden',
    attendance: 'hidden',
    employees: 'hidden',
    payroll: 'hidden',
    accounting: 'hidden',
    reports: 'hidden',
    closing: 'hidden',
    receivables: 'hidden',
    departments: 'hidden', // Cashier only places orders (auto-routed)
    drawer: 'full', // the cashier's own till
    handovers: 'hidden', // Cashier initiates handovers but doesn't approve them
    handoverForward: 'none', // the cashier's own handover IS the initiation
    orderComplimentary: 'none', // only Admin/Manager may comp an order
    kds: 'hidden',
    billing: 'create',
    settings: 'hidden',
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
    staffApproval: 'hidden',
  },
  // Awaiting Admin review — every page hidden, every action none. Mirrors
  // backend/src/core/permissions.ts's Pending block exactly.
  Pending: {
    dashboard: 'hidden',
    pos: 'hidden',
    orders: 'hidden',
    orderCancel: 'none',
    orderItemCancel: 'none',
    discount: 'none',
    tables: 'hidden',
    menu: 'hidden',
    inventory: 'hidden',
    attendance: 'hidden',
    employees: 'hidden',
    payroll: 'hidden',
    accounting: 'hidden',
    reports: 'hidden',
    closing: 'hidden',
    receivables: 'hidden',
    departments: 'hidden',
    drawer: 'none',
    handovers: 'hidden',
    handoverForward: 'none',
    orderComplimentary: 'none',
    kds: 'hidden',
    billing: 'hidden',
    settings: 'hidden',
    attendanceOverride: 'none',
    kitchen: 'hidden',
    tableAdd: 'none',
    categoryAdd: 'none',
    mostOrderedManage: 'none',
    recipeApproval: 'none',
    recipeCreate: 'none',
    inventoryAdd: 'none',
    inventoryDirectEdit: 'none',
    inventoryCreate: 'none',
    wastageReport: 'none',
    wastageApproval: 'none',
    staffApproval: 'hidden',
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
