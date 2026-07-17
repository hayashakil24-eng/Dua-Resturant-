import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  INITIAL_ORDERS,
  INITIAL_ATTENDANCE,
  INVENTORY,
  INITIAL_TRANSACTIONS,
  INITIAL_MENU,
  MENU_CATEGORIES,
  INITIAL_ADVANCES,
  INITIAL_RECIPES,
  INITIAL_RECEIVABLES,
  INITIAL_DEPARTMENTS,
  INITIAL_ONLINE_ACCOUNTS,
  TABLES,
  STAFF,
  TAX_RATE,
} from '../data/mockData.js'
import { canModify } from '../config/permissions.js'
import { convertUnit, calculateDeductions, calculateRestocks, ingredientCost, calculateRecipeCost, calculateOrderMaterialCost } from '../utils/inventoryFlow.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  // Frontend-only persistence: JSON in localStorage is this app's only store.
  // Defined first so the state initialisers below can hydrate from it.
  const loadJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  }
  const [user, setUser] = useState(null) // { name, role }
  // Orders persist: the cash drawer (activeShift) already persists, so if orders
  // reset on reload the shift's cash-sales — and therefore expected cash at
  // reconciliation — would be wrong. Keep them together.
  const [orders, setOrders] = useState(() => loadJSON('orders', INITIAL_ORDERS))
  const [attendance, setAttendance] = useState(INITIAL_ATTENDANCE)
  // Inventory & recipes are actively edited at runtime (add stock, create/
  // approve recipes) so they persist — otherwise a reload wiped approvals and
  // added stock back to the seed.
  const [inventory, setInventory] = useState(() => loadJSON('inventory', INVENTORY))
  const [menu, setMenu] = useState(INITIAL_MENU)
  const [customCategories, setCustomCategories] = useState([]) // free-text categories with no items yet
  const [tables, setTables] = useState(TABLES)
  const [staff, setStaff] = useState(STAFF)
  const [advances, setAdvances] = useState(INITIAL_ADVANCES)
  const [transactions, setTransactions] = useState(() => loadJSON('transactions', INITIAL_TRANSACTIONS))
  const [recipes, setRecipes] = useState(() => loadJSON('recipes', INITIAL_RECIPES))
  const [ingredientRequests, setIngredientRequests] = useState([])
  const [auditLog, setAuditLog] = useState([])
  // Most Ordered is a manually-curated, shared list of menu item ids (NOT
  // auto-calculated from order history). Any POS role (Cashier/Admin/Manager)
  // can add/remove items and the change is global — everyone sees the same list.
  const [mostOrderedItemIds, setMostOrderedItemIds] = useState(['cd1', 'sl3', 'sk1', 'jc1'])
  // Sequence counters persist alongside orders/transactions so ids never
  // collide with already-saved records after a reload.
  const [orderSeq, setOrderSeq] = useState(() => loadJSON('orderSeq', 1046))
  const [txnSeq, setTxnSeq] = useState(() => loadJSON('txnSeq', 500))
  // Cash drawer reconciliation: the cashier's open shift plus the closed
  // shifts (kept for the Admin/Manager dashboard). Persisted to localStorage so
  // a cashier can PAUSE (log out without reconciling) and later resume the same
  // open drawer, and so the audit trail survives a page reload. (No backend —
  // this is the app's only persistence layer.)
  const [shiftReconciliations, setShiftReconciliations] = useState(() =>
    loadJSON('shiftReconciliations', []),
  )
  const [activeShift, setActiveShift] = useState(() => loadJSON('activeShift', null))
  // Mid-shift partial cash handovers awaiting a Manager/Admin decision.
  const [pendingHandovers, setPendingHandovers] = useState(() => loadJSON('pendingHandovers', []))
  // GST toggle — a single app-wide switch (Admin → Settings) that decides whether
  // orderTotal applies TAX_RATE at all. Defaults to OFF so no GST is charged
  // anywhere until an Admin turns it on. Persisted so the choice survives reloads.
  const [gstEnabled, setGstEnabled] = useState(() => loadJSON('gstEnabled', false))
  useEffect(() => {
    try {
      localStorage.setItem('gstEnabled', JSON.stringify(gstEnabled))
    } catch {
      /* ignore */
    }
  }, [gstEnabled])

  // GST rate as a fraction (0.05 = 5%). Editable by an Admin in Settings and
  // persisted, so the cafe can set 5%, 10%, 17%, etc. TAX_RATE is only the
  // first-run default. It's applied to a bill only when gstEnabled is on.
  const [gstRate, setGstRateState] = useState(() => loadJSON('gstRate', TAX_RATE))
  useEffect(() => {
    try {
      localStorage.setItem('gstRate', JSON.stringify(gstRate))
    } catch {
      /* ignore */
    }
  }, [gstRate])

  // Admin-managed online payment accounts (Settings). Persisted so they survive
  // reloads; a cashier picks one of the ACTIVE accounts when taking an "Online"
  // payment, and the order snapshots that account (see addOrder/markPaid).
  const [onlineAccounts, setOnlineAccounts] = useState(() => loadJSON('onlineAccounts', INITIAL_ONLINE_ACCOUNTS))
  useEffect(() => {
    try {
      localStorage.setItem('onlineAccounts', JSON.stringify(onlineAccounts))
    } catch {
      /* ignore */
    }
  }, [onlineAccounts])

  // Saved end-of-day closing reports (history). Each is a snapshot of the day's
  // figures stamped with who closed and when — persisted so the record survives
  // reloads and can be reviewed/reprinted later.
  const [dailyClosings, setDailyClosings] = useState(() => loadJSON('dailyClosings', []))
  useEffect(() => {
    try {
      localStorage.setItem('dailyClosings', JSON.stringify(dailyClosings))
    } catch {
      /* ignore */
    }
  }, [dailyClosings])

  useEffect(() => {
    try {
      localStorage.setItem('shiftReconciliations', JSON.stringify(shiftReconciliations))
    } catch {
      /* ignore (private mode / quota) */
    }
  }, [shiftReconciliations])
  useEffect(() => {
    try {
      localStorage.setItem('pendingHandovers', JSON.stringify(pendingHandovers))
    } catch {
      /* ignore */
    }
  }, [pendingHandovers])
  // Account receivables (credit accounts) + their settlement history.
  const [receivables, setReceivables] = useState(() => loadJSON('receivables', INITIAL_RECEIVABLES))
  useEffect(() => {
    try {
      localStorage.setItem('receivables', JSON.stringify(receivables))
    } catch {
      /* ignore */
    }
  }, [receivables])
  // Department / counter routing map. Persisted so a re-org of counters
  // survives reloads. Menu item ids are stable constants, so stored item
  // assignments stay valid even though the menu itself isn't persisted.
  const [departments, setDepartments] = useState(() => loadJSON('departments', INITIAL_DEPARTMENTS))
  useEffect(() => {
    try {
      localStorage.setItem('departments', JSON.stringify(departments))
    } catch {
      /* ignore */
    }
  }, [departments])
  // Persist inventory + recipes so added stock and recipe approvals survive a
  // page reload (they were resetting to the seed before).
  useEffect(() => {
    try {
      localStorage.setItem('inventory', JSON.stringify(inventory))
    } catch {
      /* ignore */
    }
  }, [inventory])
  useEffect(() => {
    try {
      localStorage.setItem('recipes', JSON.stringify(recipes))
    } catch {
      /* ignore */
    }
  }, [recipes])
  // Cash-relevant state: orders + transactions + their id counters, so shift
  // reconciliation and accounting survive a page reload.
  useEffect(() => {
    try {
      localStorage.setItem('orders', JSON.stringify(orders))
    } catch {
      /* ignore */
    }
  }, [orders])
  useEffect(() => {
    try {
      localStorage.setItem('transactions', JSON.stringify(transactions))
    } catch {
      /* ignore */
    }
  }, [transactions])
  useEffect(() => {
    try {
      localStorage.setItem('orderSeq', JSON.stringify(orderSeq))
      localStorage.setItem('txnSeq', JSON.stringify(txnSeq))
    } catch {
      /* ignore */
    }
  }, [orderSeq, txnSeq])
  useEffect(() => {
    try {
      if (activeShift) localStorage.setItem('activeShift', JSON.stringify(activeShift))
      else localStorage.removeItem('activeShift')
    } catch {
      /* ignore */
    }
  }, [activeShift])

  const login = ({ role, name }) => setUser({ role, name: name || `${role} User` })
  const logout = () => setUser(null)

  // Bill breakdown for a set of line items. `discount` is a flat Rs. amount
  // taken off the gross total (subtotal + tax); clamped so the bill never
  // goes negative. Existing callers that omit it are unaffected.
  // `rate` is the GST fraction to apply. A saved order passes its own LOCKED
  // rate (order.gstRate, snapshotted at creation) so its bill never changes when
  // the Admin later edits the global rate; a not-yet-placed POS cart omits it and
  // gets today's live setting (gstEnabled ? gstRate : 0). A stored rate of 0
  // correctly means "no GST" (GST was off, or 0%, when the order was placed).
  const orderTotal = (items, discount = 0, rate) => {
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0)
    const effRate = typeof rate === 'number' ? rate : gstEnabled ? gstRate : 0
    const tax = Math.round(subtotal * effRate)
    const gross = subtotal + tax
    const discountAmt = Math.min(Math.max(0, Number(discount) || 0), gross)
    return { subtotal, tax, discount: discountAmt, total: gross - discountAmt }
  }

  // Flip the app-wide GST switch. Gated to Admin (settings is Admin-only) and
  // audited like every other money-affecting change. No-ops if the value is
  // unchanged so we don't log a phantom toggle.
  const setGst = (enabled) => {
    if (!user || !canModify(user.role, 'settings')) return
    const next = Boolean(enabled)
    if (next === gstEnabled) return
    setGstEnabled(next)
    setAuditLog((prev) => [
      {
        id: `AUD-${Date.now()}`,
        action: next ? 'GST_ENABLED' : 'GST_DISABLED',
        by: user.name,
        role: user.role,
        at: new Date().toISOString(),
      },
      ...prev,
    ])
  }

  // Set the GST rate from a percentage (e.g. 10 → 0.10). Admin-only + audited.
  // Rejects out-of-range input and no-ops if unchanged. Stored as a fraction so
  // orderTotal can multiply directly. Takes effect on every bill immediately
  // (tax is always recomputed from the current rate, not stored per order).
  const setGstRate = (pct) => {
    if (!user || !canModify(user.role, 'settings')) return
    const n = Number(pct)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { error: 'Enter a GST rate between 0 and 100.' }
    }
    const frac = Math.round(n * 100) / 10000 // keep up to 2 decimals of a percent
    if (frac === gstRate) return {}
    setGstRateState(frac)
    setAuditLog((prev) => [
      {
        id: `AUD-${Date.now()}`,
        action: 'GST_RATE_CHANGED',
        rate: `${n}%`,
        by: user.name,
        role: user.role,
        at: new Date().toISOString(),
      },
      ...prev,
    ])
    return {}
  }

  // ---- Online payment accounts (Admin → Settings) ------------------------
  // Manage the destinations a cashier attributes an "Online" payment to. All
  // three are Admin-only (settings permission), re-checked here (not just in the
  // UI), and audited. Accounts are deactivated rather than deleted so historical
  // orders that reference them keep resolving — matching the no-hard-delete rule.
  const auditAccount = (action, extra) =>
    setAuditLog((prev) => [
      { id: `AUD-${Date.now()}`, action, ...extra, by: user.name, role: user.role, at: new Date().toISOString() },
      ...prev,
    ])

  const addOnlineAccount = ({ name, type, number = '' } = {}) => {
    if (!user || !canModify(user.role, 'settings')) {
      return { error: 'Only an Admin can manage online payment accounts.' }
    }
    const clean = String(name || '').trim()
    if (!clean) return { error: 'Account name is required.' }
    if (onlineAccounts.some((a) => a.name.toLowerCase() === clean.toLowerCase())) {
      return { error: 'An account with this name already exists.' }
    }
    const account = {
      id: `OPA-${Date.now()}`,
      name: clean,
      type: String(type || '').trim() || 'Other',
      number: String(number || '').trim(),
      active: true,
    }
    setOnlineAccounts((prev) => [...prev, account])
    auditAccount('ONLINE_ACCOUNT_ADDED', { account: account.name })
    return { account }
  }

  const updateOnlineAccount = (id, patch = {}) => {
    if (!user || !canModify(user.role, 'settings')) {
      return { error: 'Only an Admin can manage online payment accounts.' }
    }
    const clean = patch.name != null ? String(patch.name).trim() : null
    if (clean === '') return { error: 'Account name is required.' }
    if (
      clean &&
      onlineAccounts.some((a) => a.id !== id && a.name.toLowerCase() === clean.toLowerCase())
    ) {
      return { error: 'An account with this name already exists.' }
    }
    setOnlineAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch, ...(clean != null && { name: clean }) } : a)),
    )
    auditAccount('ONLINE_ACCOUNT_UPDATED', { accountId: id })
    return {}
  }

  const toggleOnlineAccount = (id) => {
    if (!user || !canModify(user.role, 'settings')) return
    setOnlineAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a)))
    auditAccount('ONLINE_ACCOUNT_TOGGLED', { accountId: id })
  }

  // Persist an end-of-day closing snapshot (Admin/Manager), stamped with who
  // closed and when. Intentionally does NOT stop the POS — days are separated by
  // order timestamp, so the next day's orders fall under the next date on their
  // own. Audited like other money-affecting actions.
  const saveDailyClosing = (report) => {
    if (!user || !canModify(user.role, 'closing')) {
      return { error: 'Only an Admin or Manager can save a closing report.' }
    }
    const record = {
      id: `CLZ-${Date.now()}`,
      ...report,
      closedBy: user.name,
      closedByRole: user.role,
      closingTime: new Date().toISOString(),
    }
    setDailyClosings((prev) => [record, ...prev])
    setAuditLog((prev) => [
      {
        id: `AUD-${Date.now()}`,
        action: 'DAY_CLOSED',
        date: report.date,
        totalSales: report.totalSales,
        by: user.name,
        role: user.role,
        at: record.closingTime,
      },
      ...prev,
    ])
    return { record }
  }

  const addOrder = ({ table, waiter, items, payment, method, onlineAccount = null }) => {
    const id = `ORD-${orderSeq}`
    const paidOnline = payment === 'Paid' && method === 'Online'
    const newOrder = {
      id,
      table,
      waiter,
      items,
      payment,
      method: payment === 'Paid' ? method : '—',
      // Snapshot the online destination (name/type) so a receipt or the daily
      // reconciliation stays correct even if the account is later renamed/removed.
      onlineAccountId: paidOnline ? onlineAccount?.id ?? null : null,
      onlineAccountName: paidOnline ? onlineAccount?.name ?? null : null,
      onlineAccountType: paidOnline ? onlineAccount?.type ?? null : null,
      // Lock the GST rate in effect right now onto the order, so editing the
      // global rate later never rewrites this bill. 0 = GST was off (or 0%).
      gstRate: gstEnabled ? gstRate : 0,
      kitchen: 'Pending',
      createdAt: new Date().toISOString(),
      // Attribute the order to the open cash drawer so reconciliation counts
      // only this shift's sales (not seed/demo orders or other shifts).
      shiftId: activeShift?.id ?? null,
    }
    setOrders((prev) => [newOrder, ...prev])
    setOrderSeq((n) => n + 1)
    // Auto-deduct ingredients for any items that have an APPROVED recipe. Done
    // at placement (the single creation point for both paid & unpaid orders) so
    // it runs exactly once per order — no double-deduction on later payment.
    deductInventoryForOrder(items)
    return newOrder
  }

  // ---- Recipes ----------------------------------------------------------
  // Kitchen authors recipes (pending), Admin approves/rejects, and an approved
  // recipe drives auto-deduction above. Ingredient quantities are in the
  // inventory item's own unit and subtracted straight from its `stock`.

  const getActiveRecipe = (menuItemId) =>
    recipes.find((r) => r.menuItemId === menuItemId && r.status === 'approved')

  // Kitchen creates a recipe — always starts 'pending' (no inventory effect
  // until an Admin approves it). Only the Kitchen role may create; this guards
  // the function itself in case a UI check is ever bypassed.
  const createRecipe = ({ menuItemId, menuItemName, ingredients }) => {
    if (!user || !canModify(user.role, 'recipeCreate')) {
      return { error: 'Only Kitchen staff can create recipes.' }
    }
    // Snapshot each ingredient's ₨ cost from current inventory prices so the
    // recipe carries its material cost (used for cancellation-loss costing).
    const costedIngredients = ingredients.map((ing) => ({
      ...ing,
      costPerUnit: Number(inventory.find((x) => x.id === ing.inventoryItemId)?.costPerUnit) || 0,
      lineCost: Math.round(ingredientCost(ing, inventory)),
    }))
    const recipe = {
      id: `RCP-${Date.now()}`,
      menuItemId,
      menuItemName,
      ingredients: costedIngredients,
      totalCost: Math.round(calculateRecipeCost(ingredients, inventory)),
      status: 'pending',
      createdBy: user?.name || 'Unknown',
      createdByRole: user?.role || '—',
      createdAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectReason: null,
    }
    setRecipes((prev) => [...prev, recipe])
    setAuditLog((prev) => [
      {
        id: `AUD-${Date.now()}`,
        action: 'RECIPE_SUBMITTED',
        recipeId: recipe.id,
        recipeName: menuItemName,
        by: recipe.createdBy,
        role: recipe.createdByRole,
        at: recipe.createdAt,
      },
      ...prev,
    ])
    return recipe
  }

  // Admin-only — gated in the UI and re-checked here for safety.
  const approveRecipe = (recipeId) => {
    if (!user || !canModify(user.role, 'recipeApproval')) return
    const at = new Date().toISOString()
    setRecipes((prev) =>
      prev.map((r) =>
        r.id === recipeId
          ? { ...r, status: 'approved', approvedBy: user.name, approvedAt: at }
          : r,
      ),
    )
    setAuditLog((prev) => [
      { id: `AUD-${Date.now()}`, action: 'RECIPE_APPROVED', recipeId, by: user.name, role: user.role, at },
      ...prev,
    ])
  }

  const rejectRecipe = (recipeId, reason = '') => {
    if (!user || !canModify(user.role, 'recipeApproval')) return
    const at = new Date().toISOString()
    setRecipes((prev) =>
      prev.map((r) =>
        r.id === recipeId
          ? { ...r, status: 'rejected', rejectedBy: user.name, rejectedAt: at, rejectReason: reason }
          : r,
      ),
    )
    setAuditLog((prev) => [
      { id: `AUD-${Date.now()}`, action: 'RECIPE_REJECTED', recipeId, reason, by: user.name, role: user.role, at },
      ...prev,
    ])
  }

  // ---- Ingredient Requests (Task 4) ---------------------------------------
  const createIngredientRequest = ({ name, category }) => {
    // Check if ingredient name already exists in active requests to prevent duplicate ingredient requests
    if (ingredientRequests.some((r) => r.name.toLowerCase() === name.toLowerCase() && r.status === 'pending')) {
      return { error: 'A pending request for this ingredient already exists.' }
    }
    const newReq = {
      id: `REQ-${Date.now()}`,
      name,
      category: category || 'Other',
      status: 'pending',
      requestedBy: user?.name || 'Chef',
      requestedAt: new Date().toISOString(),
    }
    setIngredientRequests((prev) => [...prev, newReq])
    
    setAuditLog((prev) => [
      {
        id: `AUD-${Date.now()}`,
        action: 'INGREDIENT_REQUESTED',
        requestId: newReq.id,
        name: newReq.name,
        by: newReq.requestedBy,
        role: user?.role || '—',
        at: newReq.requestedAt,
      },
      ...prev,
    ])
    return newReq
  }

  const approveIngredientRequest = (requestId, { baseUnit, initialStock = 0, threshold = 10 } = {}) => {
    // Gated to Admin only (separation of duties).
    if (!user || user.role !== 'Admin') {
      return { error: 'Only Admin can approve ingredient requests.' }
    }

    let approvedReq = null
    const nowStr = new Date().toISOString()

    setIngredientRequests((prev) =>
      prev.map((r) => {
        if (r.id === requestId) {
          approvedReq = {
            ...r,
            status: 'approved',
            approvedBy: user.name,
            approvedAt: nowStr,
            baseUnit,
            initialStock,
            threshold,
          }
          return approvedReq
        }
        return r
      }),
    )

    if (approvedReq) {
      // Create new inventory item
      const newInvId = `INV-${Date.now()}`
      const newInvItem = {
        id: newInvId,
        name: approvedReq.name,
        category: approvedReq.category,
        stock: Number(initialStock) || 0,
        unit: baseUnit || 'kg',
        threshold: Number(threshold) || 10,
        active: true,
      }
      setInventory((prev) => [...prev, newInvItem])

      // Auto-update pending recipes referencing this request ID (REQ-...) to the new inventory item (INV-...)
      setRecipes((prev) =>
        prev.map((recipe) => {
          if (recipe.status === 'pending') {
            const updatedIngredients = recipe.ingredients.map((ing) => {
              if (ing.inventoryItemId === requestId) {
                return {
                  ...ing,
                  inventoryItemId: newInvId,
                  itemName: newInvItem.name,
                  unit: newInvItem.unit, // Match the approved base unit
                }
              }
              return ing
            })
            return { ...recipe, ingredients: updatedIngredients }
          }
          return recipe
        }),
      )

      setAuditLog((prev) => [
        {
          id: `AUD-${Date.now()}`,
          action: 'INGREDIENT_REQUEST_APPROVED',
          requestId,
          inventoryItemId: newInvId,
          name: approvedReq.name,
          by: user.name,
          role: user.role,
          at: nowStr,
        },
        ...prev,
      ])
      return { success: true }
    }
    return { error: 'Request not found.' }
  }

  const rejectIngredientRequest = (requestId, reason = '') => {
    if (!user || user.role !== 'Admin') {
      return { error: 'Only Admin can reject ingredient requests.' }
    }
    const nowStr = new Date().toISOString()
    setIngredientRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'rejected',
              rejectReason: reason,
              rejectedBy: user.name,
              rejectedAt: nowStr,
            }
          : r,
      ),
    )
    setAuditLog((prev) => [
      {
        id: `AUD-${Date.now()}`,
        action: 'INGREDIENT_REQUEST_REJECTED',
        requestId,
        reason,
        by: user.name,
        role: user.role,
        at: nowStr,
      },
      ...prev,
    ])
    return { success: true }
  }

  // Core feature: deduct approved-recipe ingredients from inventory for a set of
  // order line items. Items without an approved recipe are silently skipped so
  // existing orders keep working before recipes are set up.
  const deductInventoryForOrder = (orderItems = []) => {
    const deductions = calculateDeductions(orderItems, inventory, recipes)
    const entries = Object.entries(deductions)
    if (entries.length === 0) return

    setInventory((prev) =>
      prev.map((inv) => {
        const d = deductions[inv.id]
        if (!d) return inv
        // Round to 3 dp to avoid float drift (e.g. 0.1 + 0.2); never below 0.
        const next = Math.max(0, Math.round((inv.stock - d.amount) * 1000) / 1000)
        return { ...inv, stock: next }
      }),
    )
    setAuditLog((prev) => [
      {
        id: `AUD-${Date.now()}`,
        action: 'INVENTORY_AUTO_DEDUCTED',
        details: entries.map(([id, d]) => ({ inventoryItemId: id, itemName: d.itemName, deducted: d.amount, unit: d.unit })),
        by: user?.name || 'System',
        role: user?.role || '—',
        at: new Date().toISOString(),
      },
      ...prev,
    ])
  }

  const restockInventoryForOrder = (orderItems = []) => {
    const restocks = calculateRestocks(orderItems, inventory, recipes)
    const entries = Object.entries(restocks)
    if (entries.length === 0) return

    setInventory((prev) =>
      prev.map((inv) => {
        const r = restocks[inv.id]
        if (!r) return inv
        // Round to 3 dp to avoid float drift (e.g. 0.1 + 0.2)
        const next = Math.round((inv.stock + r.amount) * 1000) / 1000
        return { ...inv, stock: next }
      }),
    )
    setAuditLog((prev) => [
      {
        id: `AUD-${Date.now()}`,
        action: 'INVENTORY_RESTOCKED',
        details: entries.map(([id, r]) => ({ inventoryItemId: id, itemName: r.itemName, restocked: r.amount, unit: r.unit })),
        by: user?.name || 'System',
        role: user?.role || '—',
        at: new Date().toISOString(),
      },
      ...prev,
    ])
  }

  const markPaid = (id, method = 'Cash', onlineAccount = null) =>
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o
        const paidOnline = method === 'Online'
        // Cash enters the drawer when the bill is paid, so attribute it to the
        // shift open at payment time (an order placed unpaid earlier may be
        // settled in a later shift). An online payment also snapshots which
        // account it landed in for the receipt + daily reconciliation.
        return {
          ...o,
          payment: 'Paid',
          method,
          onlineAccountId: paidOnline ? onlineAccount?.id ?? null : null,
          onlineAccountName: paidOnline ? onlineAccount?.name ?? null : null,
          onlineAccountType: paidOnline ? onlineAccount?.type ?? null : null,
          shiftId: activeShift?.id ?? o.shiftId ?? null,
        }
      }),
    )

  // Running bill: append newly-ordered items to an existing UNPAID order (same
  // id → one combined bill at checkout) instead of opening a second order for
  // the table. Matching lines merge by qty; genuinely new lines are stamped
  // with addedAt (so a partial kitchen ticket could show just the additions).
  // Only the added items deduct inventory — the original items already did when
  // the order was first placed.
  const appendOrderItems = (orderId, newItems = []) => {
    if (!newItems.length) return null
    let updated = null
    const stamp = new Date().toISOString()
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId || o.cancelled || o.payment === 'Paid') return o
        const items = [...o.items]
        newItems.forEach((ni) => {
          const idx = items.findIndex((it) => it.id === ni.id)
          if (idx >= 0) items[idx] = { ...items[idx], qty: items[idx].qty + ni.qty }
          else items.push({ ...ni, addedAt: stamp })
        })
        updated = { ...o, items }
        return updated
      }),
    )
    if (updated) {
      deductInventoryForOrder(newItems)
      setAuditLog((prev) => [
        {
          id: `AUD-${Date.now()}`,
          action: 'ORDER_ITEMS_ADDED',
          orderId,
          table: updated.table,
          items: newItems.map((i) => `${i.name} ×${i.qty}`),
          by: user?.name || 'Unknown',
          role: user?.role || '—',
          at: stamp,
        },
        ...prev,
      ])
    }
    return updated
  }

  // Admin only — cancel an UNPAID order with a reason + audit entry. Gated in the
  // UI (orderCancel permission) and re-checked here so a bypass can't cancel.
  // A cancelled line is "reusable" (re-servable, not a loss) when its menu item
  // is flagged reusable. Strip any ::variant suffix to resolve the base item.
  const isReusableItem = (orderItem) => {
    const baseId = String(orderItem.id).split('::')[0]
    return Boolean(menu.find((m) => m.id === baseId)?.reusable)
  }

  const cancelOrder = (id, { reason, notes = '' } = {}) => {
    if (!user || !canModify(user.role, 'orderCancel')) return
    const orderToCancel = orders.find((o) => o.id === id)
    if (!orderToCancel || orderToCancel.payment !== 'Unpaid' || orderToCancel.cancelled) return

    // Split the cancelled items: reusable ones (cold drinks, ice cream, bread,
    // sides) can be re-served to another customer, so we RESTOCK them and they
    // are NOT a loss. The rest were cooked-to-order and are wasted, so they stay
    // deducted and their material cost is booked as a loss.
    const reusableItems = orderToCancel.items.filter((it) => isReusableItem(it))
    const wastedItems = orderToCancel.items.filter((it) => !isReusableItem(it))
    const materialLoss = Math.round(
      calculateOrderMaterialCost(wastedItems, inventory, recipes),
    )
    if (reusableItems.length) restockInventoryForOrder(reusableItems)

    const recorded = {
      reason,
      notes,
      materialLoss,
      by: user?.name || 'Unknown',
      role: user?.role || '—',
      at: new Date().toISOString(),
    }

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o
        return { ...o, cancelled: true, cancellation: recorded, materialLoss }
      }),
    )

    setAuditLog((prev) => [
      { id: `AUD-${Date.now()}`, orderId: id, action: 'CANCELLED', ...recorded },
      ...prev,
    ])
  }

  // ₨ material cost an order would write off if cancelled now — only the wasted
  // (non-reusable) items count, matching cancelOrder. Lets the cancel dialog
  // preview the loss before it's confirmed.
  const orderMaterialLoss = (items = []) =>
    Math.round(
      calculateOrderMaterialCost(items.filter((it) => !isReusableItem(it)), inventory, recipes),
    )

  const updateOrderItemQty = (orderId, itemId, newQty) => {
    const orderObj = orders.find((o) => o.id === orderId)
    if (!orderObj || orderObj.cancelled || orderObj.payment === 'Paid') return

    const itemObj = orderObj.items.find((it) => it.id === itemId)
    if (!itemObj) return

    const oldQty = itemObj.qty
    if (oldQty === newQty) return

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o
        const items = o.items.map((it) => {
          if (it.id === itemId) {
            return { ...it, qty: newQty }
          }
          return it
        })
        return { ...o, items }
      }),
    )

    const diffQty = newQty - oldQty
    if (diffQty > 0) {
      // Deduct more inventory
      deductInventoryForOrder([{ ...itemObj, qty: diffQty }])
    } else if (diffQty < 0) {
      // Restock inventory
      restockInventoryForOrder([{ ...itemObj, qty: Math.abs(diffQty) }])
    }

    setAuditLog((prev) => [
      {
        id: `AUD-${Date.now()}`,
        action: 'ORDER_QTY_UPDATED',
        orderId,
        itemId,
        itemName: itemObj.name,
        oldQty,
        newQty,
        by: user?.name || 'System',
        role: user?.role || '—',
        at: new Date().toISOString(),
      },
      ...prev,
    ])
  }

  // Admin/Manager only — apply a flat discount to an order with a reason +
  // audit entry. Clamped to the bill total so it can never go negative.
  const applyDiscount = (id, { amount, reason = '', notes = '' } = {}) => {
    let recorded = null
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id || o.cancelled) return o
        const { total } = orderTotal(o.items, 0, o.gstRate) // gross bill, before any discount
        const amt = Math.min(Math.max(0, Number(amount) || 0), total)
        if (amt <= 0) return o
        recorded = {
          amount: amt,
          reason: reason || 'Manual Discount',
          notes,
          by: user?.name || 'Unknown',
          role: user?.role || '—',
          at: new Date().toISOString(),
        }
        return { ...o, discount: recorded }
      }),
    )
    if (recorded) {
      setAuditLog((prev) => [
        { id: `AUD-${Date.now()}`, orderId: id, action: 'DISCOUNT', ...recorded },
        ...prev,
      ])
    }
  }

  const removeDiscount = (id) =>
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id || !o.discount) return o
        const { discount, ...rest } = o
        return rest
      }),
    )

  // --- Cash drawer reconciliation -----------------------------------------
  // Cash & card taken in since a shift opened. Orders don't record which
  // cashier rang them up, so (single-drawer mock) sales are attributed by the
  // shift's time window + payment method, using the same bill math as the POS.
  // Sum a shift's collected sales by attribution (order.shiftId), not by
  // timestamp — so seed/demo orders and other shifts' orders never leak into
  // this drawer's expected cash.
  const shiftSalesForShift = (shiftId) => {
    let totalCashSales = 0
    let totalCardSales = 0
    orders.forEach((o) => {
      if (o.payment !== 'Paid' || o.cancelled) return
      if (o.shiftId !== shiftId) return
      const total = orderTotal(o.items, o.discount?.amount, o.gstRate).total
      if (o.method === 'Cash') totalCashSales += total
      else if (o.method === 'Card') totalCardSales += total
    })
    return { totalCashSales, totalCardSales }
  }

  const calculateShiftSales = (shiftId) => {
    const shift =
      activeShift?.id === shiftId
        ? activeShift
        : shiftReconciliations.find((s) => s.id === shiftId)
    if (!shift) return null
    const { totalCashSales, totalCardSales } = shiftSalesForShift(shift.id)
    // Cash handed over mid-shift (accepted partial handovers) leaves the drawer,
    // so it reduces the cash the cashier is accountable for at reconciliation.
    const handedOver = (shift.partialHandovers || []).reduce((s, h) => s + h.amount, 0)
    return {
      totalCashSales,
      totalCardSales,
      handedOver,
      expectedCash: shift.openingCash + totalCashSales - handedOver,
    }
  }

  const startShift = (openingCash) => {
    const opening = Math.max(0, Number(openingCash) || 0)
    const shift = {
      id: `SHIFT-${Date.now()}`,
      cashierName: user?.name || 'Cashier',
      role: user?.role || 'Cashier',
      shiftStartTime: new Date().toISOString(),
      shiftEndTime: null,
      openingCash: opening,
      totalCashSales: 0,
      totalCardSales: 0,
      expectedCash: opening,
      actualCash: null,
      difference: 0,
      status: 'active',
    }
    setActiveShift(shift)
    setShiftReconciliations((prev) => [shift, ...prev])
    return shift
  }

  // Pause: the cashier logs out but the open drawer stays (persisted), so it can
  // be resumed on the next login without re-entering opening cash.
  const pauseShift = () =>
    setActiveShift((s) => (s ? { ...s, status: 'paused', pausedAt: new Date().toISOString() } : s))

  // Resume a paused drawer — back to active, counting resumes for the audit.
  const resumeShift = () =>
    setActiveShift((s) =>
      s
        ? {
            ...s,
            status: 'active',
            resumedAt: new Date().toISOString(),
            resumeCount: (s.resumeCount || 0) + 1,
          }
        : s,
    )

  // Close a shift against a physical cash count. difference = expected − actual
  // (positive → shortage, negative → excess). Within Rs. 10 counts as matched.
  // `handover` records who the drawer cash was handed to (Admin/Manager/staff)
  // and an optional note, for the audit trail.
  const endShift = (shiftId, actualCash, handover = {}) => {
    const sales = calculateShiftSales(shiftId)
    if (!sales) return null
    const actual = Math.max(0, Number(actualCash) || 0)
    const difference = sales.expectedCash - actual
    const status =
      Math.abs(difference) < 10 ? 'matched' : difference > 0 ? 'shortage' : 'excess'
    const handedTo = handover.to || null
    const handedToName = handover.name || handover.to || null
    const handoverReason = handover.reason || ''

    let closed = null
    setShiftReconciliations((prev) =>
      prev.map((s) => {
        if (s.id !== shiftId) return s
        closed = {
          ...s,
          shiftEndTime: new Date().toISOString(),
          totalCashSales: sales.totalCashSales,
          totalCardSales: sales.totalCardSales,
          expectedCash: sales.expectedCash,
          actualCash: actual,
          difference,
          status,
          handedTo,
          handedToName,
          handoverReason,
        }
        return closed
      }),
    )
    setActiveShift(null)

    if (closed) {
      setAuditLog((prev) => [
        {
          id: `AUD-${Date.now()}`,
          action: 'SHIFT_RECONCILIATION',
          by: closed.cashierName,
          role: closed.role,
          expectedCash: closed.expectedCash,
          actualCash: actual,
          difference,
          status,
          handedTo,
          handedToName,
          handoverReason,
          at: closed.shiftEndTime,
        },
        ...prev,
      ])
    }
    return closed
  }

  // --- Partial handover with approval ------------------------------------
  // A cashier hands part of the drawer to a Manager/Admin mid-shift. It stays
  // PENDING until the recipient (any logged-in Manager/Admin) accepts — only
  // then does the cash leave the drawer (reduces expected at reconciliation).
  const initiateHandover = ({ amount, toName, toRole, reason = '' } = {}) => {
    if (!activeShift) return { error: 'No active shift.' }
    const amt = Math.max(0, Number(amount) || 0)
    const current = calculateShiftSales(activeShift.id)?.expectedCash ?? activeShift.openingCash
    if (amt <= 0 || amt > current) return { error: 'Enter a valid amount within the drawer balance.' }
    const at = new Date().toISOString()
    const ho = {
      id: `HO-${Date.now()}`,
      shiftId: activeShift.id,
      fromName: activeShift.cashierName,
      toName: toName || 'Manager',
      toRole: toRole || 'Manager',
      amount: amt,
      reason,
      status: 'pending',
      initiatedAt: at,
    }
    setPendingHandovers((prev) => [ho, ...prev])
    setAuditLog((prev) => [
      { id: `AUD-${Date.now()}`, action: 'HANDOVER_INITIATED', amount: amt, from: ho.fromName, to: ho.toName, by: ho.fromName, role: 'Cashier', at },
      ...prev,
    ])
    return { success: true, id: ho.id }
  }

  const acceptHandover = (id) => {
    if (!user || !['Manager', 'Admin'].includes(user.role)) return { error: 'Not authorised.' }
    const ho = pendingHandovers.find((h) => h.id === id)
    if (!ho || ho.status !== 'pending') return { error: 'Handover not found.' }
    const at = new Date().toISOString()
    setPendingHandovers((prev) =>
      prev.map((h) => (h.id === id ? { ...h, status: 'accepted', resolvedAt: at, resolvedBy: user.name } : h)),
    )
    // Record on the shift so reconciliation subtracts it from expected cash.
    setActiveShift((s) =>
      s && s.id === ho.shiftId
        ? { ...s, partialHandovers: [...(s.partialHandovers || []), { id: ho.id, amount: ho.amount, to: ho.toName, at }] }
        : s,
    )
    setAuditLog((prev) => [
      { id: `AUD-${Date.now()}`, action: 'HANDOVER_ACCEPTED', amount: ho.amount, from: ho.fromName, to: ho.toName, by: user.name, role: user.role, at },
      ...prev,
    ])
    return { success: true }
  }

  const rejectHandover = (id, reason = '') => {
    if (!user || !['Manager', 'Admin'].includes(user.role)) return { error: 'Not authorised.' }
    const ho = pendingHandovers.find((h) => h.id === id)
    if (!ho || ho.status !== 'pending') return { error: 'Handover not found.' }
    const at = new Date().toISOString()
    setPendingHandovers((prev) =>
      prev.map((h) => (h.id === id ? { ...h, status: 'rejected', rejectReason: reason, resolvedAt: at, resolvedBy: user.name } : h)),
    )
    setAuditLog((prev) => [
      { id: `AUD-${Date.now()}`, action: 'HANDOVER_REJECTED', amount: ho.amount, from: ho.fromName, to: ho.toName, reason, by: user.name, role: user.role, at },
      ...prev,
    ])
    return { success: true }
  }

  // Kitchen Display: Pending → Ready → Served (Served drops off the board)
  const markReady = (id) =>
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, kitchen: 'Ready' } : o)),
    )

  const clearKitchen = (id) =>
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, kitchen: 'Served' } : o)),
    )

  // Normal attendance is fed by the biometric machine (seed data / machine
  // sync). These records are read-only in the UI — no manual buttons.

  // Admin-only emergency override. Sets check-in/out for a staff member when
  // the machine failed, tags the record as a manual entry, and writes an audit
  // trail (who, when, why) — same pattern as cancelOrder/applyDiscount.
  const overrideAttendance = (staffId, { checkIn, checkOut, reason, notes = '' } = {}) => {
    if (!reason) return
    const staffMember = staff.find((s) => s.id === staffId)
    const status = checkOut ? 'Checked Out' : checkIn ? 'Present' : 'Absent'
    const manualEntry = {
      enteredBy: user?.name || 'Unknown',
      role: user?.role || '—',
      reason,
      notes,
      enteredAt: new Date().toISOString(),
    }
    setAttendance((prev) => ({
      ...prev,
      [staffId]: {
        checkIn: checkIn ?? prev[staffId]?.checkIn ?? null,
        checkOut: checkOut ?? prev[staffId]?.checkOut ?? null,
        status,
        source: 'manual',
        manualEntry,
      },
    }))
    setAuditLog((prev) => [
      {
        id: `AUD-${Date.now()}`,
        action: 'ATTENDANCE_OVERRIDE',
        staffId,
        staffName: staffMember?.name || staffId,
        by: manualEntry.enteredBy,
        role: manualEntry.role,
        reason,
        notes,
        at: manualEntry.enteredAt,
      },
      ...prev,
    ])
  }

  // Adjust a stock line by a delta (restock or consume); never drops below 0
  const adjustStock = (id, delta) =>
    setInventory((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, stock: Math.max(0, i.stock + delta) } : i,
      ),
    )

  const restock = (id, amount = 10) => adjustStock(id, Math.abs(amount))

  // Create a brand-new inventory item directly (Admin only). This is a separate,
  // proactive path from the Chef's ingredient-request → approveIngredientRequest
  // flow; both coexist. Rejects blank/duplicate names (case-insensitive) and
  // mints the next sequential INV## id following the seed data pattern.
  const addInventoryItem = ({ name, nameUr = '', category, unit, stock = 0, threshold = 0, costPerUnit = 0 } = {}) => {
    if (!user || !canModify(user.role, 'inventoryCreate')) {
      return { error: 'You are not allowed to add new inventory items.' }
    }
    const trimmed = (name || '').trim()
    if (!trimmed) return { error: 'Item name is required.' }
    if (inventory.some((i) => i.name.toLowerCase() === trimmed.toLowerCase())) {
      return { error: `“${trimmed}” already exists in inventory.` }
    }

    // Next id = max INV## suffix + 1, zero-padded to 2 (e.g. INV16). Ignores the
    // timestamp-style ids the ingredient-request flow uses so both can coexist.
    const maxNum = inventory.reduce((max, i) => {
      const m = /^INV0*(\d+)$/.exec(i.id)
      return m ? Math.max(max, Number(m[1])) : max
    }, 0)
    const id = `INV${String(maxNum + 1).padStart(2, '0')}`

    const item = {
      id,
      name: trimmed,
      nameUr: (nameUr || '').trim(), // optional Urdu name shown in Urdu mode
      category: (category || 'Other').trim() || 'Other',
      stock: Math.max(0, Number(stock) || 0),
      unit: unit || 'kg',
      threshold: Math.max(0, Number(threshold) || 0),
      costPerUnit: Math.max(0, Number(costPerUnit) || 0), // ₨ per unit, for recipe costing
      active: true,
    }
    setInventory((prev) => [...prev, item])
    setAuditLog((prev) => [
      {
        id: `AUD-${Date.now()}`,
        action: 'INVENTORY_ITEM_CREATED',
        inventoryItemId: id,
        name: item.name,
        by: user.name,
        role: user.role,
        at: new Date().toISOString(),
      },
      ...prev,
    ])
    return { success: true, item }
  }

  // Accounting ledger
  const addTransaction = ({ type, category, description, amount, date }) => {
    const txn = {
      id: `TXN-${txnSeq}`,
      type,
      category,
      description,
      amount: Number(amount),
      date: date || new Date().toISOString(),
    }
    setTransactions((prev) => [txn, ...prev])
    setTxnSeq((n) => n + 1)
    return txn
  }

  const deleteTransaction = (id) =>
    setTransactions((prev) => prev.filter((tx) => tx.id !== id))

  // Table management (Admin/Manager/Cashier add & edit; delete Admin-only)
  const addTable = ({ id, seats, section }) => {
    // Admin/Manager only — the UI hides the control, this is the safety net.
    if (!user || !canModify(user.role, 'tableAdd')) return
    const num = Number(id)
    if (tables.some((t) => t.id === num)) return // duplicate — ignore
    setAuditLog((prev) => [
      {
        id: `AUD-${Date.now()}`,
        action: 'TABLE_ADDED',
        table: num,
        seats: Number(seats) || 2,
        by: user.name,
        role: user.role,
        at: new Date().toISOString(),
      },
      ...prev,
    ])
    setTables((prev) =>
      prev.some((t) => t.id === num)
        ? prev
        : [...prev, { id: num, seats: Number(seats) || 2, section: section || '' }].sort(
            (a, b) => a.id - b.id,
          ),
    )
  }
  const updateTable = (id, updates) =>
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
  // Locked tables (Delivery/Takeaway) are fixed order types and can't be removed.
  const deleteTable = (id) =>
    setTables((prev) => prev.filter((t) => t.id !== id || t.locked))

  // Employee management (Admin/Manager). Drives Payroll, Attendance, waiters.
  const waiters = useMemo(
    () => staff.filter((s) => s.active !== false && s.role === 'Waiter'),
    [staff],
  )
  const addStaff = (emp) => {
    const created = {
      role: 'Waiter',
      shift: 'Morning',
      baseSalary: 0,
      active: true,
      ...emp,
      id: `S-${Date.now()}`,
    }
    setStaff((prev) => [...prev, created])
    return created
  }
  const updateStaff = (id, updates) =>
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)))
  const deleteStaff = (id) => setStaff((prev) => prev.filter((s) => s.id !== id))
  const toggleStaff = (id) =>
    setStaff((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: s.active === false } : s)),
    )

  // Salary advances — multiple dated entries per staff, deducted at payroll.
  const addAdvance = ({ staffId, amount, reason = '', date }) => {
    const adv = {
      id: `ADV-${Date.now()}`,
      staffId,
      amount: Number(amount),
      reason,
      date: date || new Date().toISOString(),
      status: 'pending',
    }
    setAdvances((prev) => [adv, ...prev])
    return adv
  }
  const deleteAdvance = (id) => setAdvances((prev) => prev.filter((a) => a.id !== id))
  // Mark a month's pending advances as recovered (called on payroll confirm).
  const recoverAdvances = (year, monthIndex) =>
    setAdvances((prev) =>
      prev.map((a) => {
        const d = new Date(a.date)
        return a.status === 'pending' &&
          d.getFullYear() === year &&
          d.getMonth() === monthIndex
          ? { ...a, status: 'recovered' }
          : a
      }),
    )

  // Menu management — edits here flow straight to the POS.
  const addMenuItem = (item) => {
    const created = { active: true, ...item, id: `MI-${Date.now()}` }
    setMenu((prev) => [...prev, created])
    return created
  }
  const updateMenuItem = (id, updates) =>
    setMenu((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)))
  const deleteMenuItem = (id) =>
    setMenu((prev) => prev.filter((m) => m.id !== id))
  const toggleMenuItem = (id) =>
    setMenu((prev) => prev.map((m) => (m.id === id ? { ...m, active: !m.active } : m)))
  const replaceMenu = (items) => setMenu(items)

  // --- Most Ordered (manual, shared) --------------------------------------
  // Add or remove a menu item from the shared Most Ordered list, with an audit
  // entry recording who changed it. Any POS role may call this.
  const toggleMostOrdered = (menuItemId) => {
    let wasIn = false
    setMostOrderedItemIds((prev) => {
      wasIn = prev.includes(menuItemId)
      return wasIn ? prev.filter((id) => id !== menuItemId) : [...prev, menuItemId]
    })
    setAuditLog((prev) => [
      {
        id: `AUD-${Date.now()}`,
        action: wasIn ? 'MOST_ORDERED_REMOVED' : 'MOST_ORDERED_ADDED',
        menuItemId,
        by: user?.name || 'Unknown',
        role: user?.role || '—',
        at: new Date().toISOString(),
      },
      ...prev,
    ])
  }

  // Resolve the curated ids to live menu objects, dropping any that were since
  // deleted or deactivated so the POS never renders a stale/broken card.
  const getMostOrderedItems = () =>
    mostOrderedItemIds
      .map((id) => menu.find((m) => m.id === id))
      .filter((m) => m && m.active !== false)

  // Categories present in the menu plus any free-text categories an
  // Admin/Manager added (which may not have items yet), in canonical order
  // (canonical first, custom/extras appended).
  const menuCategories = useMemo(() => {
    const all = [...new Set([...menu.map((m) => m.category), ...customCategories])]
    const ordered = MENU_CATEGORIES.filter((c) => all.includes(c))
    const extras = all.filter((c) => !MENU_CATEGORIES.includes(c))
    return [...ordered, ...extras]
  }, [menu, customCategories])

  // Add a free-text category (Admin/Manager). No fixed/predefined list — any
  // name is allowed; only blanks and case-insensitive duplicates are rejected.
  const addCategory = (name) => {
    if (!user || !canModify(user.role, 'categoryAdd')) return { error: 'Not allowed.' }
    const trimmed = (name || '').trim()
    if (!trimmed) return { error: 'Category name cannot be empty.' }
    const dup = [...menu.map((m) => m.category), ...customCategories].some(
      (c) => c.toLowerCase() === trimmed.toLowerCase(),
    )
    if (dup) return { error: 'This category already exists.' }
    setCustomCategories((prev) => [...prev, trimmed])
    setAuditLog((prev) => [
      {
        id: `AUD-${Date.now()}`,
        action: 'CATEGORY_ADDED',
        category: trimmed,
        by: user.name,
        role: user.role,
        at: new Date().toISOString(),
      },
      ...prev,
    ])
    return { success: true }
  }

  // Delete a category — Admin/Manager, and ONLY when empty (no menu item uses
  // it). A non-empty category can't actually be removed anyway (menuCategories
  // derives it back from the items), so we block with a clear, counted message.
  const deleteCategory = (name) => {
    if (!user || !canModify(user.role, 'categoryAdd')) return { error: 'Not authorized.' }
    const inUse = menu.filter((m) => m.category.toLowerCase() === name.toLowerCase()).length
    if (inUse > 0) {
      return {
        error: `Cannot delete — ${inUse} item${inUse > 1 ? 's' : ''} still use “${name}”. Move or delete ${inUse > 1 ? 'them' : 'it'} first.`,
      }
    }
    setCustomCategories((prev) => prev.filter((c) => c.toLowerCase() !== name.toLowerCase()))
    setAuditLog((prev) => [
      {
        id: `AUD-${Date.now()}`,
        action: 'CATEGORY_DELETED',
        category: name,
        by: user.name,
        role: user.role,
        at: new Date().toISOString(),
      },
      ...prev,
    ])
    return { success: true }
  }

  // Items at or below their threshold — drives low-stock alerts
  const lowStock = useMemo(
    () => inventory.filter((i) => i.stock <= i.threshold),
    [inventory],
  )

  // Derived stats for dashboard
  const stats = useMemo(() => {
    const revenue = orders
      .filter((o) => o.payment === 'Paid' && !o.cancelled)
      .reduce((s, o) => s + orderTotal(o.items, o.discount?.amount, o.gstRate).total, 0)
    const pending = orders.filter((o) => o.payment === 'Unpaid' && !o.cancelled).length
    const activeTables = new Set(
      orders.filter((o) => o.payment === 'Unpaid' && !o.cancelled).map((o) => o.table),
    ).size
    const present = Object.values(attendance).filter(
      (a) => a.status === 'Present' || a.status === 'Late',
    ).length
    return {
      orderCount: orders.length,
      revenue,
      pending,
      activeTables,
      present,
      totalStaff: staff.filter((s) => s.active !== false).length,
      lowStockCount: lowStock.length,
    }
  }, [orders, attendance, lowStock, staff])

  // --- Account receivables -------------------------------------------------
  const canSettleReceivables = () => Boolean(user && canModify(user.role, 'receivables'))

  // Add a new credit account (or record a fresh "on account" balance).
  const addReceivable = ({ name, amount, type = 'customer', notes = '' } = {}) => {
    if (!canSettleReceivables()) return { error: 'Not authorised.' }
    const trimmed = (name || '').trim()
    const amt = Math.max(0, Number(amount) || 0)
    if (!trimmed) return { error: 'Account name is required.' }
    const rcv = {
      id: `RCV-${Date.now()}`,
      name: trimmed,
      type,
      balance: amt,
      status: amt > 0 ? 'open' : 'settled',
      notes,
      createdAt: new Date().toISOString(),
      payments: [],
    }
    setReceivables((prev) => [...prev, rcv])
    setAuditLog((prev) => [
      { id: `AUD-${Date.now()}`, action: 'RECEIVABLE_ADDED', account: trimmed, amount: amt, by: user.name, role: user.role, at: rcv.createdAt },
      ...prev,
    ])
    return { success: true, id: rcv.id }
  }

  // Record a payment against an account. If it clears the balance the account
  // is marked settled. `amount` omitted ⇒ settle the whole balance.
  const recordReceivablePayment = (id, amount, { method = 'Cash', notes = '' } = {}) => {
    if (!canSettleReceivables()) return { error: 'Not authorised.' }
    const rcv = receivables.find((r) => r.id === id)
    if (!rcv || rcv.status === 'settled') return { error: 'Account not found or already settled.' }
    const pay = amount == null ? rcv.balance : Math.max(0, Number(amount) || 0)
    if (pay <= 0 || pay > rcv.balance) return { error: 'Enter a valid amount up to the outstanding balance.' }
    const at = new Date().toISOString()
    const remaining = rcv.balance - pay
    const settled = remaining <= 0
    const entry = { id: `PAY-${Date.now()}`, amount: pay, method, notes, by: user.name, role: user.role, at }
    setReceivables((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, balance: settled ? 0 : remaining, status: settled ? 'settled' : 'open', payments: [entry, ...(r.payments || [])] }
          : r,
      ),
    )
    setAuditLog((prev) => [
      {
        id: `AUD-${Date.now()}`,
        action: settled ? 'RECEIVABLE_SETTLED' : 'RECEIVABLE_PAYMENT',
        account: rcv.name,
        amount: pay,
        remaining: settled ? 0 : remaining,
        method,
        notes,
        by: user.name,
        role: user.role,
        at,
      },
      ...prev,
    ])
    return { success: true, settled }
  }

  // Convert an unpaid order into an on-account (udhaar) credit sale. The order
  // is flagged Udhaar and its total is added to a customer's Receivable — an
  // existing open account or a new one. This reuses the single receivables
  // ledger (no separate udhaar store). Manager/Admin only.
  const markOrderUdhaar = (orderId, { accountId = '', customerName = '' } = {}) => {
    if (!user || !canModify(user.role, 'receivables')) return { error: 'Not authorised.' }
    const order = orders.find((o) => o.id === orderId)
    if (!order || order.cancelled) return { error: 'Order not found.' }
    if (order.payment !== 'Unpaid') return { error: 'Only unpaid orders can be put on account.' }
    const amount = orderTotal(order.items, order.discount?.amount, order.gstRate).total
    if (amount <= 0) return { error: 'Order total is zero.' }
    const at = new Date().toISOString()

    let account = accountId ? receivables.find((r) => r.id === accountId && r.status !== 'settled') : null
    const name = account ? account.name : (customerName || '').trim()
    if (!account && !name) return { error: 'Customer name is required.' }
    const charge = { orderId, amount, at, by: user.name }

    if (account) {
      setReceivables((prev) =>
        prev.map((r) =>
          r.id === account.id
            ? { ...r, balance: r.balance + amount, status: 'open', charges: [charge, ...(r.charges || [])] }
            : r,
        ),
      )
    } else {
      account = {
        id: `RCV-${Date.now()}`,
        name,
        type: 'customer',
        balance: amount,
        status: 'open',
        notes: 'On-account from order',
        createdAt: at,
        payments: [],
        charges: [charge],
      }
      setReceivables((prev) => [...prev, account])
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, payment: 'Udhaar', method: 'Udhaar', udhaarCustomerName: name, udhaarAccountId: account.id, udhaarAt: at, udhaarBy: user.name }
          : o,
      ),
    )
    setAuditLog((prev) => [
      { id: `AUD-${Date.now()}`, action: 'ORDER_UDHAAR', orderId, amount, account: name, by: user.name, role: user.role, at },
      ...prev,
    ])
    return { success: true, accountId: account.id }
  }

  // Mark an unpaid order as complimentary (free / on-the-house): no cash, no
  // receivable — it's written off with an authoriser + reason for the audit
  // trail. Manager/Admin only. method 'Free' keeps it out of drawer cash and
  // payment 'Complimentary' keeps it out of revenue.
  const markOrderComplimentary = (orderId, { orderedBy = '', reason = '', notes = '' } = {}) => {
    if (!user || !canModify(user.role, 'orderComplimentary')) return { error: 'Not authorised.' }
    const order = orders.find((o) => o.id === orderId)
    if (!order || order.cancelled) return { error: 'Order not found.' }
    if (order.payment !== 'Unpaid') return { error: 'Only unpaid orders can be made complimentary.' }
    const who = (orderedBy || '').trim()
    if (!who) return { error: 'Enter who authorised the free order.' }
    const amount = orderTotal(order.items, order.discount?.amount, order.gstRate).total
    const at = new Date().toISOString()

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              payment: 'Complimentary',
              method: 'Free',
              complimentary: { reason, orderedBy: who, orderedByRole: user.role, approvedBy: user.name, at },
              complimentaryAt: at,
              complimentaryBy: user.name,
            }
          : o,
      ),
    )
    setAuditLog((prev) => [
      { id: `AUD-${Date.now()}`, action: 'ORDER_COMPLIMENTARY', orderId, amount, orderedBy: who, reason, by: user.name, role: user.role, at },
      ...prev,
    ])
    return { success: true }
  }

  // ---- Department / counter routing --------------------------------------
  // Only Admin/Manager may reconfigure counters (defense-in-depth; the route
  // is already permission-gated). `getDepartmentForItem` is read-only and
  // ungated so the KDS/POS can resolve routing for any role.
  const canManageDepartments = () => Boolean(user && canModify(user.role, 'departments'))

  const addDepartment = ({ name, nameUrdu = '', description = '', manager = '', managerId = '' } = {}) => {
    if (!canManageDepartments()) return { error: 'Not authorised.' }
    const trimmed = (name || '').trim()
    if (!trimmed) return { error: 'Department name is required.' }
    const dept = {
      id: `DEPT-${Date.now()}`,
      name: trimmed,
      nameUrdu: (nameUrdu || '').trim(),
      description: (description || '').trim(),
      manager: (manager || '').trim(),
      managerId,
      status: 'active',
      createdBy: user.name,
      createdAt: new Date().toISOString(),
      items: [],
    }
    setDepartments((prev) => [...prev, dept])
    return { success: true, id: dept.id }
  }

  const deleteDepartment = (id) => {
    if (!canManageDepartments()) return { error: 'Not authorised.' }
    setDepartments((prev) => prev.filter((d) => d.id !== id))
    return { success: true }
  }

  // Assigning an item MOVES it: it is removed from every other counter first so
  // each item routes to exactly one department (no ambiguous KOT routing).
  const assignItemToDepartment = (itemId, departmentId) => {
    if (!canManageDepartments()) return { error: 'Not authorised.' }
    setDepartments((prev) =>
      prev.map((d) => {
        if (d.id === departmentId) {
          return d.items.includes(itemId) ? d : { ...d, items: [...d.items, itemId] }
        }
        return d.items.includes(itemId) ? { ...d, items: d.items.filter((i) => i !== itemId) } : d
      }),
    )
    return { success: true }
  }

  const removeItemFromDepartment = (itemId, departmentId) => {
    if (!canManageDepartments()) return { error: 'Not authorised.' }
    setDepartments((prev) =>
      prev.map((d) => (d.id === departmentId ? { ...d, items: d.items.filter((i) => i !== itemId) } : d)),
    )
    return { success: true }
  }

  // Resolve the counter that owns a menu item. Order lines use a cart key of
  // `id` or `id::variant`, so match on the base id before the "::".
  const getDepartmentForItem = (itemId) => {
    if (itemId == null) return null
    const baseId = String(itemId).split('::')[0]
    return departments.find((d) => d.items.includes(baseId)) || null
  }

  const value = {
    user,
    login,
    logout,
    orders,
    addOrder,
    appendOrderItems,
    markPaid,
    markReady,
    clearKitchen,
    cancelOrder,
    orderMaterialLoss,
    updateOrderItemQty,
    applyDiscount,
    removeDiscount,
    auditLog,
    orderTotal,
    gstEnabled,
    gstRate,
    setGst,
    setGstRate,
    onlineAccounts,
    addOnlineAccount,
    updateOnlineAccount,
    toggleOnlineAccount,
    dailyClosings,
    saveDailyClosing,
    attendance,
    overrideAttendance,
    inventory,
    lowStock,
    adjustStock,
    restock,
    addInventoryItem,
    transactions,
    addTransaction,
    deleteTransaction,
    recipes,
    createRecipe,
    approveRecipe,
    rejectRecipe,
    ingredientRequests,
    createIngredientRequest,
    approveIngredientRequest,
    rejectIngredientRequest,
    getActiveRecipe,
    menu,
    menuCategories,
    addCategory,
    deleteCategory,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleMenuItem,
    replaceMenu,
    mostOrderedItemIds,
    toggleMostOrdered,
    getMostOrderedItems,
    tables,
    addTable,
    updateTable,
    deleteTable,
    staff,
    waiters,
    addStaff,
    updateStaff,
    deleteStaff,
    toggleStaff,
    advances,
    addAdvance,
    deleteAdvance,
    recoverAdvances,
    shiftReconciliations,
    activeShift,
    startShift,
    pauseShift,
    resumeShift,
    endShift,
    calculateShiftSales,
    pendingHandovers,
    initiateHandover,
    acceptHandover,
    rejectHandover,
    receivables,
    addReceivable,
    recordReceivablePayment,
    markOrderUdhaar,
    markOrderComplimentary,
    departments,
    addDepartment,
    deleteDepartment,
    assignItemToDepartment,
    removeItemFromDepartment,
    getDepartmentForItem,
    stats,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
