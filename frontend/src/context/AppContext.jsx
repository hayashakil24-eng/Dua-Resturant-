import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { MENU_CATEGORIES, TAX_RATE, registerTableLabels } from '../data/mockData.js'
import { calculateOrderMaterialCost } from '../utils/inventoryFlow.js'
import { apiGet, apiPost, apiPatch, apiPut, apiDelete, setToken, getToken, ApiError, BASE } from '../api/client.js'

const AppContext = createContext(null)

// Phase 2 (LAN real-time): the backend broadcasts one 'audit' socket event per
// state-changing action — see backend/src/realtime/broadcast.ts. This maps
// each action name to the FETCHERS key(s) that need a refetch so another
// device's screen updates without a manual refresh. An action not listed here
// simply doesn't trigger a live refetch (nothing in the UI depends on it
// updating cross-device yet) — safe default, not a bug if one is missing.
const ACTION_REFETCH_MAP = {
  ORDER_PLACED: ['orders'],
  ORDER_PAID: ['orders'],
  ORDER_READY: ['orders'],
  ITEM_READY: ['orders'],
  ORDER_SERVED: ['orders'],
  ORDER_ITEMS_ADDED: ['orders'],
  ORDER_QTY_UPDATED: ['orders'],
  ORDER_TABLE_SHIFTED: ['orders'],
  CANCELLED: ['orders'],
  DISCOUNT: ['orders'],
  DISCOUNT_REMOVED: ['orders'],
  ORDER_UDHAAR: ['orders', 'receivables'],
  ORDER_COMPLIMENTARY: ['orders'],
  INVENTORY_AUTO_DEDUCTED: ['inventory'],
  INVENTORY_RESTOCKED: ['inventory'],
  STOCK_ADJUSTED: ['inventory'],
  INVENTORY_ITEM_CREATED: ['inventory'],
  TABLE_ADDED: ['tables'],
  TABLE_UPDATED: ['tables'],
  TABLE_DELETED: ['tables'],
  TABLES_BULK_ADDED: ['tables'],
  TABLE_CATEGORY_RENAMED: ['tables'],
  TABLE_CATEGORY_UPDATED: ['tables'],
  TABLE_CATEGORY_DELETED: ['tables'],
  STAFF_ADDED: ['staff'],
  STAFF_DELETED: ['staff'],
  STAFF_SIGNUP_REQUESTED: ['pendingSignups'],
  STAFF_SIGNUP_APPROVED: ['pendingSignups', 'staff'],
  STAFF_SIGNUP_REJECTED: ['pendingSignups'],
  CATEGORY_ADDED: ['categories', 'menu'],
  CATEGORY_DELETED: ['categories', 'menu'],
  MOST_ORDERED_ADDED: ['mostOrdered'],
  MOST_ORDERED_REMOVED: ['mostOrdered'],
  RECIPE_SUBMITTED: ['recipes'],
  RECIPE_UPDATED: ['recipes'],
  RECIPE_DELETED: ['recipes'],
  RECIPE_APPROVED: ['recipes'],
  RECIPE_REJECTED: ['recipes'],
  INGREDIENT_REQUESTED: ['ingredientRequests'],
  INGREDIENT_REQUEST_APPROVED: ['ingredientRequests', 'inventory'],
  INGREDIENT_REQUEST_REJECTED: ['ingredientRequests'],
  TRANSACTION_ADDED: ['transactions'],
  TRANSACTION_DELETED: ['transactions'],
  STOCK_PURCHASED: ['inventory', 'purchases', 'transactions'],
  ADVANCE_GIVEN: ['advances', 'transactions'],
  ADVANCE_DELETED: ['advances', 'transactions'],
  RECEIVABLE_SETTLED: ['receivables'],
  RECEIVABLE_PAYMENT: ['receivables'],
  SHIFT_STARTED: ['shifts', 'activeShift'],
  SHIFT_PAUSED: ['shifts', 'activeShift'],
  SHIFT_RESUMED: ['shifts', 'activeShift'],
  SHIFT_RECONCILIATION: ['shifts', 'activeShift'],
  HANDOVER_INITIATED: ['handovers'],
  HANDOVER_ACCEPTED: ['handovers', 'activeShift'],
  HANDOVER_REJECTED: ['handovers'],
  ONLINE_ACCOUNT_ADDED: ['onlineAccounts'],
  ONLINE_ACCOUNT_UPDATED: ['onlineAccounts'],
  ONLINE_ACCOUNT_TOGGLED: ['onlineAccounts'],
  GST_ENABLED: ['settings'],
  GST_DISABLED: ['settings'],
  GST_RATE_CHANGED: ['settings'],
  DAY_CLOSED: ['dailyClosings'],
}

// Map any thrown ApiError to the { error } shape the existing UI already reads
// (pages do `const res = await fn(); if (res?.error) ...`). Success paths return
// the useful object instead.
const toError = (e) => ({ error: e?.message || 'Something went wrong.' })

// Orders/transactions carry a server cuid plus a human display id ("ORD-1046",
// "TXN-500"). The UI shows and keys on the human id, so we surface it as `id`
// and keep the server id as `serverId` for API paths.
const normalizeOrder = (o) => ({ ...o, id: o.displayId || o.id, serverId: o.id })
const normalizeTxn = (t) => ({ ...t, id: `TXN-${t.txnNumber}`, serverId: t.id })
// Re-derive the frontend's separate payments[]/charges[] arrays from the unified
// ledger (the backend stores one dated ledger with a type discriminator).
const normalizeReceivable = (r) => ({
  ...r,
  payments: (r.ledger || []).filter((l) => l.type === 'payment'),
  charges: (r.ledger || []).filter((l) => l.type === 'charge'),
})

export function AppProvider({ children }) {
  // Session bootstrap: while true we don't render the app, so a page never
  // flashes /login before a stored token has had a chance to restore.
  const [booting, setBooting] = useState(true)
  const [user, setUser] = useState(null) // { id, name, role }

  const [orders, setOrders] = useState([])
  const [inventory, setInventory] = useState([])
  const [purchases, setPurchases] = useState([])
  const [menu, setMenu] = useState([])
  const [customCategories, setCustomCategories] = useState([])
  const [tables, setTables] = useState([])
  const [staff, setStaff] = useState([])
  const [pendingSignups, setPendingSignups] = useState([])
  const [advances, setAdvances] = useState([])
  const [transactions, setTransactions] = useState([])
  const [recipes, setRecipes] = useState([])
  const [ingredientRequests, setIngredientRequests] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [mostOrderedItemIds, setMostOrderedItemIds] = useState([])
  const [shiftReconciliations, setShiftReconciliations] = useState([])
  const [activeShift, setActiveShift] = useState(null)
  const [pendingHandovers, setPendingHandovers] = useState([])
  const [gstEnabled, setGstEnabled] = useState(false)
  const [gstRate, setGstRateState] = useState(TAX_RATE)
  const [whatsappReport, setWhatsappReport] = useState({ enabled: false, hour: 23, recipient: '' })
  const [onlineAccounts, setOnlineAccounts] = useState([])
  const [dailyClosings, setDailyClosings] = useState([])
  const [receivables, setReceivables] = useState([])
  const [departments, setDepartments] = useState([])
  // Fetched from the backend's AttendanceRecord table (today's rows only —
  // see attendance.service.ts). There's still no real biometric machine feed,
  // so a staff member with no row today (no override, no machine integration)
  // correctly reads as absent via resolveAttendanceStatus's `!record` branch —
  // that's real "no data" here, not a demo placeholder.
  const [attendance, setAttendance] = useState({})

  // --- Data loading -------------------------------------------------------
  // One fetcher per collection; refresh(keys) pulls a subset after a mutation.
  const FETCHERS = {
    orders: () => apiGet('/api/orders').then((d) => setOrders((d.orders || []).map(normalizeOrder))),
    inventory: () => apiGet('/api/inventory').then((d) => setInventory(d.inventory || [])),
    purchases: () => apiGet('/api/inventory/purchases').then((d) => setPurchases(d.purchases || [])),
    menu: () => apiGet('/api/menu').then((d) => setMenu(d.menu || [])),
    categories: () => apiGet('/api/categories').then((d) => setCustomCategories(d.categories || [])),
    tables: () =>
      apiGet('/api/tables').then((d) => {
        // Register live labels so tableLabel() reflects renamed tables/categories
        // everywhere (POS/Orders/KDS/bill) — see registerTableLabels in mockData.
        registerTableLabels(d.tables || [])
        setTables(d.tables || [])
      }),
    staff: () => apiGet('/api/staff').then((d) => setStaff(d.staff || [])),
    pendingSignups: () => apiGet('/api/staff/pending-signups').then((d) => setPendingSignups(d.pendingSignups || [])),
    advances: () => apiGet('/api/advances').then((d) => setAdvances(d.advances || [])),
    transactions: () => apiGet('/api/transactions').then((d) => setTransactions((d.transactions || []).map(normalizeTxn))),
    recipes: () => apiGet('/api/recipes').then((d) => setRecipes(d.recipes || [])),
    ingredientRequests: () => apiGet('/api/ingredient-requests').then((d) => setIngredientRequests(d.requests || [])),
    mostOrdered: () => apiGet('/api/most-ordered').then((d) => setMostOrderedItemIds(d.mostOrdered || [])),
    shifts: () => apiGet('/api/shifts').then((d) => setShiftReconciliations(d.shifts || [])),
    activeShift: () => apiGet('/api/shifts/active').then((d) => setActiveShift(d.shift || null)),
    handovers: () => apiGet('/api/handovers').then((d) => setPendingHandovers(d.handovers || [])),
    settings: () =>
      apiGet('/api/settings').then((d) => {
        setGstEnabled(Boolean(d.settings?.gstEnabled))
        setGstRateState(d.settings?.gstRate ?? TAX_RATE)
        setWhatsappReport({
          enabled: Boolean(d.settings?.whatsappReportEnabled),
          hour: d.settings?.whatsappReportHour ?? 23,
          recipient: d.settings?.whatsappReportRecipient ?? '',
        })
      }),
    onlineAccounts: () => apiGet('/api/online-accounts').then((d) => setOnlineAccounts(d.accounts || [])),
    dailyClosings: () => apiGet('/api/closings').then((d) => setDailyClosings(d.closings || [])),
    receivables: () => apiGet('/api/receivables').then((d) => setReceivables((d.receivables || []).map(normalizeReceivable))),
    departments: () => apiGet('/api/departments').then((d) => setDepartments(d.departments || [])),
    audit: () => apiGet('/api/audit').then((d) => setAuditLog(d.audit || [])),
    attendance: () =>
      apiGet('/api/attendance').then((d) => {
        const map = {}
        ;(d.attendance || []).forEach((r) => {
          map[r.staffId] = {
            checkIn: r.checkIn,
            checkOut: r.checkOut,
            status: r.status,
            source: r.source,
            ...(r.source === 'manual' && {
              manualEntry: {
                enteredBy: r.manualBy,
                role: r.manualByRole,
                reason: r.manualReason,
                notes: r.manualNotes,
                enteredAt: r.manualAt,
              },
            }),
          }
        })
        setAttendance(map)
      }),
  }

  const refresh = async (keys) => {
    await Promise.all(
      keys.map((k) =>
        FETCHERS[k]().catch((e) => {
          // A role without access to a collection just gets none of it (the same
          // data was never shown for that role before). Anything else re-throws.
          if (e instanceof ApiError && (e.status === 403 || e.status === 401)) return
          throw e
        }),
      ),
    )
  }
  const refreshAll = () => refresh(Object.keys(FETCHERS))

  // refresh/refreshAll close over state setters that are stable across
  // renders, but the functions themselves are re-created every render — kept
  // in a ref so the socket effect below can always call the latest version
  // without reconnecting every render (it only depends on `user`).
  const refreshRef = useRef({ refresh, refreshAll })
  refreshRef.current = { refresh, refreshAll }

  // Phase 2: one Socket.IO connection per logged-in session, joining the
  // backend's single broadcast room (realtime/socket.ts). Reconnect (e.g.
  // after the beach-WiFi drop docs/03-phase-2 calls out) triggers a full
  // refreshAll() rather than trying to replay whatever was missed while
  // offline — simplest correct way to resync.
  useEffect(() => {
    if (!user) return
    const socket = io(BASE, { auth: { token: getToken() } })
    socket.on('audit', (event) => {
      const keys = ACTION_REFETCH_MAP[event?.action]
      if (keys?.length) refreshRef.current.refresh(keys).catch(() => {})
    })
    socket.io.on('reconnect', () => {
      refreshRef.current.refreshAll().catch(() => {})
    })
    return () => {
      socket.disconnect()
    }
  }, [user])

  // Restore a session from a stored token on first mount.
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!getToken()) {
        setBooting(false)
        return
      }
      try {
        const me = await apiGet('/api/auth/me')
        if (!alive) return
        setUser(me.user)
        // A waiting-room session has nothing to fetch (every FETCHERS route
        // 403s for role 'Pending' — see backend guard.ts) — the PendingApproval
        // page needs no collections, just the user object already set above.
        if (me.user?.role !== 'Pending') await refreshAll()
      } catch {
        setToken(null)
      } finally {
        if (alive) setBooting(false)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = async ({ username, password }) => {
    try {
      const { token, user: u } = await apiPost('/api/auth/login', { username, password })
      setToken(token)
      setUser(u)
      if (u.role !== 'Pending') await refreshAll()
      return { user: u }
    } catch (e) {
      return toError(e)
    }
  }
  // Public self-signup — deliberately no token/user side effects. The new
  // account is 'pending' until an Admin approves it; the caller (Signup.jsx)
  // shows a confirmation and sends the user to /login to sign in separately.
  const signup = async ({ name, username, password }) => {
    try {
      await apiPost('/api/auth/signup', { name, username, password })
      return { ok: true }
    } catch (e) {
      return toError(e)
    }
  }
  // Password changes. Anyone signed in may change their own (the server
  // verifies the current one); only an Admin may reset somebody else's, which
  // signs that person's devices out — both checks are re-run server-side.
  const changeMyPassword = async ({ currentPassword, newPassword } = {}) => {
    try {
      return await apiPost('/api/auth/change-password', { currentPassword, newPassword })
    } catch (e) {
      return toError(e)
    }
  }
  // `username`/`systemRole` are only read server-side when the employee has no
  // login yet — that's how an Employees-page row (created without credentials)
  // gets its first one.
  const setStaffPassword = async (staffId, newPassword, { username, systemRole } = {}) => {
    if (!user || user.role !== 'Admin') return { error: 'Only an Admin can change another user’s password.' }
    try {
      const res = await apiPost(`/api/staff/${staffId}/password`, { newPassword, username, systemRole })
      await refresh(['staff'])
      return res
    } catch (e) {
      return toError(e)
    }
  }

  const logout = () => {
    // Best-effort, not awaited: revokes this session server-side (keeps the
    // Control Panel's connected-devices list accurate) but must never block
    // or fail the actual logout if the server is unreachable.
    apiPost('/api/auth/logout').catch(() => {})
    setToken(null)
    setUser(null)
  }

  // Bill breakdown for a set of line items. A saved order passes its own LOCKED
  // rate (order.gstRate); a live POS cart omits it and gets today's setting.
  // Unchanged pure function — see backend/src/core/orderTotal.ts.
  const orderTotal = (items, discount = 0, rate) => {
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0)
    const effRate = typeof rate === 'number' ? rate : gstEnabled ? gstRate : 0
    const tax = Math.round(subtotal * effRate)
    const gross = subtotal + tax
    const discountAmt = Math.min(Math.max(0, Number(discount) || 0), gross)
    return { subtotal, tax, discount: discountAmt, total: gross - discountAmt }
  }

  // Resolve an order's human id → the server cuid the API paths need.
  const orderSid = (id) => orders.find((o) => o.id === id)?.serverId ?? id
  const txnSid = (id) => transactions.find((t) => t.id === id)?.serverId ?? id

  // ---- Settings ----------------------------------------------------------
  const setGst = async (enabled) => {
    try {
      await apiPost('/api/settings/gst', { enabled: Boolean(enabled) })
      await refresh(['settings'])
    } catch (e) {
      return toError(e)
    }
  }
  const setGstRate = async (pct) => {
    try {
      await apiPost('/api/settings/gst-rate', { pct: Number(pct) })
      await refresh(['settings'])
      return {}
    } catch (e) {
      return toError(e)
    }
  }
  const setWhatsappReportConfig = async (patch = {}) => {
    try {
      await apiPost('/api/settings/whatsapp-report', patch)
      await refresh(['settings'])
      return {}
    } catch (e) {
      return toError(e)
    }
  }
  const addOnlineAccount = async ({ name, type, number = '', bankName = '', iban = '' } = {}) => {
    try {
      const { account } = await apiPost('/api/online-accounts', { name, type, number, bankName, iban })
      await refresh(['onlineAccounts'])
      return { account }
    } catch (e) {
      return toError(e)
    }
  }
  const updateOnlineAccount = async (id, patch = {}) => {
    try {
      await apiPatch(`/api/online-accounts/${id}`, patch)
      await refresh(['onlineAccounts'])
      return {}
    } catch (e) {
      return toError(e)
    }
  }
  const toggleOnlineAccount = async (id) => {
    try {
      await apiPost(`/api/online-accounts/${id}/toggle`)
      await refresh(['onlineAccounts'])
    } catch (e) {
      return toError(e)
    }
  }

  const saveDailyClosing = async (report) => {
    try {
      const { record } = await apiPost('/api/closings', { date: report?.date })
      await refresh(['dailyClosings'])
      return { record }
    } catch (e) {
      return toError(e)
    }
  }

  // ---- Orders ------------------------------------------------------------
  const addOrder = async ({ table, waiter, items, payment, method, onlineAccount = null }) => {
    try {
      const { order } = await apiPost('/api/orders', {
        table,
        waiter,
        items: items.map((it) => ({ id: it.id, menuItemId: it.menuItemId, variantLabel: it.variantLabel, name: it.name, price: it.price, qty: it.qty, cost: it.cost, costEstimated: it.costEstimated })),
        payment,
        method,
        onlineAccountId: onlineAccount?.id ?? null,
      })
      await refresh(['orders', 'inventory'])
      return normalizeOrder(order)
    } catch (e) {
      return toError(e)
    }
  }

  const appendOrderItems = async (orderId, newItems = []) => {
    if (!newItems.length) return null
    try {
      const { order } = await apiPost(`/api/orders/${orderSid(orderId)}/items`, {
        items: newItems.map((it) => ({ id: it.id, menuItemId: it.menuItemId, variantLabel: it.variantLabel, name: it.name, price: it.price, qty: it.qty, cost: it.cost, costEstimated: it.costEstimated })),
      })
      await refresh(['orders', 'inventory'])
      return order ? normalizeOrder(order) : null
    } catch (e) {
      return toError(e)
    }
  }

  const markPaid = async (id, method = 'Cash', onlineAccount = null) => {
    try {
      await apiPost(`/api/orders/${orderSid(id)}/pay`, { method, onlineAccountId: onlineAccount?.id ?? null })
      await refresh(['orders'])
    } catch (e) {
      return toError(e)
    }
  }

  const markReady = async (id) => {
    try {
      await apiPost(`/api/orders/${orderSid(id)}/ready`)
      await refresh(['orders'])
    } catch (e) {
      return toError(e)
    }
  }
  // Toggle one line ready on the KDS; the order auto-flips to Ready when all
  // lines are done. `itemId` is the OrderItem DB id (order.items[].itemId).
  const markItemReady = async (id, itemId) => {
    try {
      await apiPost(`/api/orders/${orderSid(id)}/items/${itemId}/ready`)
      await refresh(['orders'])
    } catch (e) {
      return toError(e)
    }
  }
  const clearKitchen = async (id) => {
    try {
      await apiPost(`/api/orders/${orderSid(id)}/served`)
      await refresh(['orders'])
    } catch (e) {
      return toError(e)
    }
  }

  const cancelOrder = async (id, { reason, notes = '', cooked } = {}) => {
    try {
      await apiPost(`/api/orders/${orderSid(id)}/cancel`, { reason, notes, cooked })
      await refresh(['orders', 'inventory'])
    } catch (e) {
      return toError(e)
    }
  }

  const updateOrderItemQty = async (orderId, itemId, newQty) => {
    try {
      await apiPatch(`/api/orders/${orderSid(orderId)}/items`, { itemKey: itemId, qty: newQty })
      await refresh(['orders', 'inventory'])
    } catch (e) {
      return toError(e)
    }
  }

  // Re-seat a running order onto another table (party moved seats). Server-side
  // this only rewrites the table column — no money/inventory change — so a plain
  // refetch of orders is enough for every device to show the new table.
  const shiftOrderTable = async (id, newTable) => {
    try {
      await apiPost(`/api/orders/${orderSid(id)}/table`, { table: newTable })
      await refresh(['orders'])
    } catch (e) {
      return toError(e)
    }
  }

  // Either a flat rupee `amount` or a whole-number `percent` of the bill — when
  // a percent is sent the server derives the rupees, so the two can't drift.
  const applyDiscount = async (id, { amount, percent, reason = '', notes = '' } = {}) => {
    try {
      await apiPost(`/api/orders/${orderSid(id)}/discount`, { amount, percent, reason, notes })
      await refresh(['orders'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }
  const removeDiscount = async (id) => {
    try {
      await apiDelete(`/api/orders/${orderSid(id)}/discount`)
      await refresh(['orders'])
    } catch (e) {
      return toError(e)
    }
  }

  const markOrderUdhaar = async (orderId, { accountId = '', customerName = '' } = {}) => {
    try {
      const res = await apiPost(`/api/orders/${orderSid(orderId)}/udhaar`, { accountId, customerName })
      await refresh(['orders', 'receivables'])
      return { success: true, accountId: res.accountId }
    } catch (e) {
      return toError(e)
    }
  }

  const markOrderComplimentary = async (orderId, { orderedBy = '', reason = '', notes = '' } = {}) => {
    try {
      await apiPost(`/api/orders/${orderSid(orderId)}/complimentary`, { orderedBy, reason, notes })
      await refresh(['orders'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }

  // Approved recipe for a menu item (pure — reads state).
  const getActiveRecipe = (menuItemId) => recipes.find((r) => r.menuItemId === menuItemId && r.status === 'approved')

  // ₨ material an order would write off if cancelled now — only wasted
  // (non-reusable) items count, matching the backend. Pure preview helper.
  const isReusableItem = (orderItem) => {
    const baseId = String(orderItem.menuItemId || orderItem.id).split('::')[0]
    return Boolean(menu.find((m) => m.id === baseId)?.reusable)
  }
  const orderMaterialLoss = (items = []) =>
    Math.round(calculateOrderMaterialCost(items.filter((it) => !isReusableItem(it)), inventory, recipes))

  // ---- Recipes -----------------------------------------------------------
  const createRecipe = async ({ menuItemId, menuItemName, ingredients }) => {
    try {
      const { recipe } = await apiPost('/api/recipes', { menuItemId, menuItemName, ingredients })
      await refresh(['recipes'])
      return recipe
    } catch (e) {
      return toError(e)
    }
  }
  const updateRecipe = async (recipeId, { ingredients }) => {
    try {
      const { recipe } = await apiPatch(`/api/recipes/${recipeId}`, { ingredients })
      await refresh(['recipes'])
      return recipe
    } catch (e) {
      return toError(e)
    }
  }
  const deleteRecipe = async (recipeId, reason = '') => {
    try {
      await apiDelete(`/api/recipes/${recipeId}`, { reason })
      await refresh(['recipes'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }
  const approveRecipe = async (recipeId) => {
    try {
      await apiPost(`/api/recipes/${recipeId}/approve`)
      await refresh(['recipes'])
    } catch (e) {
      return toError(e)
    }
  }
  const rejectRecipe = async (recipeId, reason = '') => {
    try {
      await apiPost(`/api/recipes/${recipeId}/reject`, { reason })
      await refresh(['recipes'])
    } catch (e) {
      return toError(e)
    }
  }

  const createIngredientRequest = async ({ name, category }) => {
    try {
      const { request } = await apiPost('/api/ingredient-requests', { name, category })
      await refresh(['ingredientRequests'])
      return request
    } catch (e) {
      return toError(e)
    }
  }
  const approveIngredientRequest = async (requestId, { baseUnit, initialStock = 0, threshold = 10 } = {}) => {
    try {
      await apiPost(`/api/ingredient-requests/${requestId}/approve`, { baseUnit, initialStock, threshold })
      await refresh(['ingredientRequests', 'inventory', 'recipes'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }
  const rejectIngredientRequest = async (requestId, reason = '') => {
    try {
      await apiPost(`/api/ingredient-requests/${requestId}/reject`, { reason })
      await refresh(['ingredientRequests'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }

  // ---- Inventory ---------------------------------------------------------
  const adjustStock = async (id, delta) => {
    try {
      await apiPost(`/api/inventory/${id}/adjust`, { delta })
      await refresh(['inventory'])
    } catch (e) {
      return toError(e)
    }
  }
  // Buying stock — raises quantity and books the spend as a dated expense in
  // one call, so the purchase reaches the reports. Distinct from adjustStock,
  // which also serves miscount corrections (no money moved).
  const recordPurchase = async (id, { quantity, unitCost, totalCost, supplier, date } = {}) => {
    try {
      await apiPost(`/api/inventory/${id}/purchase`, { quantity, unitCost, totalCost, supplier, date })
      await refresh(['inventory', 'purchases', 'transactions'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }
  const restock = async (id, amount = 10) => {
    try {
      await apiPost(`/api/inventory/${id}/restock`, { amount })
      await refresh(['inventory'])
    } catch (e) {
      return toError(e)
    }
  }
  const addInventoryItem = async (payload = {}) => {
    try {
      const { item } = await apiPost('/api/inventory', payload)
      await refresh(['inventory'])
      return { success: true, item }
    } catch (e) {
      return toError(e)
    }
  }

  // ---- Accounting --------------------------------------------------------
  const addTransaction = async ({ type, category, description, amount, date }) => {
    try {
      const { transaction } = await apiPost('/api/transactions', { type, category, description, amount, date })
      await refresh(['transactions'])
      return normalizeTxn(transaction)
    } catch (e) {
      return toError(e)
    }
  }
  const deleteTransaction = async (id) => {
    try {
      await apiDelete(`/api/transactions/${txnSid(id)}`)
      await refresh(['transactions'])
    } catch (e) {
      return toError(e)
    }
  }

  // ---- Tables ------------------------------------------------------------
  // `id` is optional — the server allocates max+1 inside its transaction, which
  // is the only collision-free choice when two managers add tables at once.
  const addTable = async ({ id, number, category, seats, section }) => {
    try {
      await apiPost('/api/tables', { ...(id != null ? { id: Number(id) } : {}), number, category, seats, section })
      await refresh(['tables'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }
  // A whole hall in one call: 40 single adds would be 40 transactions and 40
  // socket broadcasts, each making every device refetch the full table list.
  const bulkAddTables = async ({ category, count, seats, section }) => {
    try {
      const res = await apiPost('/api/tables/bulk', { category, count, seats, section })
      await refresh(['tables'])
      return { success: true, ...res }
    } catch (e) {
      return toError(e)
    }
  }
  const updateTable = async (id, updates) => {
    try {
      await apiPatch(`/api/tables/${id}`, updates)
      await refresh(['tables'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }
  const deleteTable = async (id) => {
    try {
      await apiDelete(`/api/tables/${id}`)
      await refresh(['tables'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }
  // The hall edit form: rename (merging into an existing hall keeps that hall's
  // numbering), restyle seats/section, grow it, straighten drifted labels.
  const updateTableCategory = async ({ category, newName, seats, section, count, renumber }) => {
    try {
      const res = await apiPost('/api/tables/category/update', { category, newName, seats, section, count, renumber })
      await refresh(['tables'])
      return { success: true, ...res }
    } catch (e) {
      return toError(e)
    }
  }
  const renameTableCategory = async (from, name) => {
    try {
      await apiPost('/api/tables/category/rename', { from, name })
      await refresh(['tables'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }
  const deleteTableCategory = async (category) => {
    try {
      await apiPost('/api/tables/category/delete', { category })
      await refresh(['tables'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }

  // ---- Employees + advances ---------------------------------------------
  const waiters = useMemo(() => staff.filter((s) => s.active !== false && s.role === 'Waiter'), [staff])

  const addStaff = async (emp) => {
    try {
      const { staff: created } = await apiPost('/api/staff', emp)
      await refresh(['staff'])
      return created
    } catch (e) {
      return toError(e)
    }
  }
  const updateStaff = async (id, updates) => {
    try {
      await apiPatch(`/api/staff/${id}`, updates)
      await refresh(['staff'])
    } catch (e) {
      return toError(e)
    }
  }
  const deleteStaff = async (id) => {
    try {
      await apiDelete(`/api/staff/${id}`)
      await refresh(['staff'])
    } catch (e) {
      return toError(e)
    }
  }
  const toggleStaff = async (id) => {
    try {
      await apiPost(`/api/staff/${id}/toggle`)
      await refresh(['staff'])
    } catch (e) {
      return toError(e)
    }
  }
  const approveSignup = async (id, systemRole) => {
    try {
      const { staff: updated } = await apiPost(`/api/staff/${id}/approve-signup`, { systemRole })
      await refresh(['pendingSignups', 'staff'])
      return updated
    } catch (e) {
      return toError(e)
    }
  }
  const rejectSignup = async (id, reason = '') => {
    try {
      await apiPost(`/api/staff/${id}/reject-signup`, { reason })
      await refresh(['pendingSignups'])
    } catch (e) {
      return toError(e)
    }
  }

  const addAdvance = async ({ staffId, amount, reason = '', date }) => {
    try {
      const { advance } = await apiPost('/api/advances', { staffId, amount, reason, date })
      await refresh(['advances'])
      return advance
    } catch (e) {
      return toError(e)
    }
  }
  const deleteAdvance = async (id) => {
    try {
      await apiDelete(`/api/advances/${id}`)
      await refresh(['advances'])
    } catch (e) {
      return toError(e)
    }
  }
  // staffId omitted → recover the whole month (payroll confirm); with staffId →
  // just that staff's advances (their "Done" in the payroll modal).
  const recoverAdvances = async (year, monthIndex, staffId) => {
    try {
      await apiPost('/api/advances/recover', { year, monthIndex, staffId })
      await refresh(['advances'])
    } catch (e) {
      return toError(e)
    }
  }

  // ---- Menu / categories / most-ordered ---------------------------------
  const addMenuItem = async (item) => {
    try {
      const { item: created } = await apiPost('/api/menu', item)
      await refresh(['menu', 'categories'])
      return created
    } catch (e) {
      return toError(e)
    }
  }
  const updateMenuItem = async (id, updates) => {
    try {
      await apiPatch(`/api/menu/${id}`, updates)
      await refresh(['menu', 'categories'])
    } catch (e) {
      return toError(e)
    }
  }
  const deleteMenuItem = async (id) => {
    try {
      await apiDelete(`/api/menu/${id}`)
      await refresh(['menu', 'categories'])
    } catch (e) {
      return toError(e)
    }
  }
  const toggleMenuItem = async (id) => {
    try {
      await apiPost(`/api/menu/${id}/toggle`)
      await refresh(['menu'])
    } catch (e) {
      return toError(e)
    }
  }
  const replaceMenu = async (items) => {
    try {
      await apiPut('/api/menu', { items })
      await refresh(['menu', 'categories'])
    } catch (e) {
      return toError(e)
    }
  }

  const toggleMostOrdered = async (menuItemId) => {
    try {
      await apiPost(`/api/most-ordered/${menuItemId}/toggle`)
      await refresh(['mostOrdered'])
    } catch (e) {
      return toError(e)
    }
  }
  const getMostOrderedItems = () =>
    mostOrderedItemIds.map((id) => menu.find((m) => m.id === id)).filter((m) => m && m.active !== false)

  const menuCategories = useMemo(() => {
    const all = [...new Set([...menu.map((m) => m.category), ...customCategories])]
    const ordered = MENU_CATEGORIES.filter((c) => all.includes(c))
    const extras = all.filter((c) => !MENU_CATEGORIES.includes(c))
    return [...ordered, ...extras]
  }, [menu, customCategories])

  const addCategory = async (name) => {
    try {
      await apiPost('/api/categories', { name })
      await refresh(['categories', 'menu'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }
  const deleteCategory = async (name) => {
    try {
      await apiDelete(`/api/categories/${encodeURIComponent(name)}`)
      await refresh(['categories', 'menu'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }

  const lowStock = useMemo(() => inventory.filter((i) => i.stock <= i.threshold), [inventory])

  // Business-day "session" boundary — the most recent closing's time. Live
  // figures (Dashboard revenue, Closing preview) scope to orders after this so
  // the screen resets the moment a day is closed (demand.md #9). Null before the
  // first ever closing = whole history counts as the current session.
  const lastClosingAt = useMemo(() => {
    if (!dailyClosings.length) return null
    return dailyClosings.reduce((max, c) => (c.closingTime > max ? c.closingTime : max), dailyClosings[0].closingTime)
  }, [dailyClosings])

  const stats = useMemo(() => {
    const sinceMs = lastClosingAt ? new Date(lastClosingAt).getTime() : null
    const inSession = (o) => sinceMs === null || new Date(o.createdAt).getTime() > sinceMs
    const revenue = orders
      .filter((o) => o.payment === 'Paid' && !o.cancelled && inSession(o))
      .reduce((s, o) => s + orderTotal(o.items, o.discount?.amount, o.gstRate).total, 0)
    const pending = orders.filter((o) => o.payment === 'Unpaid' && !o.cancelled).length
    const activeTables = new Set(orders.filter((o) => o.payment === 'Unpaid' && !o.cancelled).map((o) => o.table)).size
    const present = Object.values(attendance).filter((a) => a.status === 'Present' || a.status === 'Late').length
    return {
      orderCount: orders.length,
      revenue,
      pending,
      activeTables,
      present,
      totalStaff: staff.filter((s) => s.active !== false).length,
      lowStockCount: lowStock.length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, attendance, lowStock, staff, gstEnabled, gstRate, lastClosingAt])

  // ---- Cash drawer (reads are computed locally; writes hit the backend) ---
  const shiftSalesForShift = (shiftId) => {
    let totalCashSales = 0
    let totalCardSales = 0
    let totalOnlineSales = 0
    orders.forEach((o) => {
      if (o.payment !== 'Paid' || o.cancelled) return
      if (o.shiftId !== shiftId) return
      const total = orderTotal(o.items, o.discount?.amount, o.gstRate).total
      if (o.method === 'Cash') totalCashSales += total
      else if (o.method === 'Card') totalCardSales += total
      else if (o.method === 'Online') totalOnlineSales += total
    })
    return { totalCashSales, totalCardSales, totalOnlineSales }
  }

  const calculateShiftSales = (shiftId) => {
    const shift = activeShift?.id === shiftId ? activeShift : shiftReconciliations.find((s) => s.id === shiftId)
    if (!shift) return null
    const { totalCashSales, totalCardSales, totalOnlineSales } = shiftSalesForShift(shift.id)
    // Accepted mid-shift handovers left the drawer, reducing accountable cash.
    // A 'shift_end' handover is the whole counted drawer handed over after
    // reconciliation, so it must not reduce this shift's expectedCash.
    const handedOver = pendingHandovers
      .filter((h) => h.shiftId === shift.id && h.status === 'accepted' && h.kind !== 'shift_end')
      .reduce((s, h) => s + h.amount, 0)
    // Card/Online never enter the drawer — they're shown for the cashier's
    // sanity check only, so expectedCash stays cash-only.
    return {
      totalCashSales,
      totalCardSales,
      totalOnlineSales,
      handedOver,
      expectedCash: shift.openingCash + totalCashSales - handedOver,
    }
  }

  const startShift = async (openingCash) => {
    try {
      const { shift } = await apiPost('/api/shifts/start', { openingCash })
      await refresh(['shifts', 'activeShift'])
      return shift
    } catch (e) {
      return toError(e)
    }
  }
  const pauseShift = async () => {
    try {
      await apiPost('/api/shifts/pause')
      await refresh(['shifts', 'activeShift'])
    } catch (e) {
      return toError(e)
    }
  }
  const resumeShift = async () => {
    try {
      await apiPost('/api/shifts/resume')
      await refresh(['shifts', 'activeShift'])
    } catch (e) {
      return toError(e)
    }
  }
  const endShift = async (shiftId, actualCash, handover = {}) => {
    try {
      const { shift } = await apiPost(`/api/shifts/${shiftId}/end`, { actualCash, handover })
      // 'handovers' too: ending a shift with a recipient creates a pending
      // shift-end handover for the Manager/Admin to approve.
      await refresh(['shifts', 'activeShift', 'handovers'])
      return shift
    } catch (e) {
      return toError(e)
    }
  }

  const initiateHandover = async ({ amount, toName, toRole, reason = '' } = {}) => {
    try {
      const { handover } = await apiPost('/api/handovers', { amount, toName, toRole, reason })
      await refresh(['handovers', 'activeShift'])
      return { success: true, id: handover?.id }
    } catch (e) {
      return toError(e)
    }
  }
  // Manager forwarding collected cash up to the Admin — no drawer involved, so
  // no activeShift refetch. The amount is capped server-side by what the
  // manager is actually still holding.
  const forwardHandover = async ({ amount, reason = '' } = {}) => {
    try {
      const { handover } = await apiPost('/api/handovers/forward', { amount, reason })
      await refresh(['handovers'])
      return { success: true, id: handover?.id }
    } catch (e) {
      return toError(e)
    }
  }
  const acceptHandover = async (id) => {
    try {
      await apiPost(`/api/handovers/${id}/accept`)
      await refresh(['handovers', 'activeShift', 'shifts'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }
  const rejectHandover = async (id, reason = '') => {
    try {
      await apiPost(`/api/handovers/${id}/reject`, { reason })
      await refresh(['handovers'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }

  // ---- Attendance -----------------------------------------------------
  const overrideAttendance = async (staffId, { checkIn, checkOut, reason, notes = '' } = {}) => {
    if (!reason) return
    try {
      await apiPost(`/api/attendance/${staffId}/override`, { checkIn, checkOut, reason, notes })
      await refresh(['attendance'])
    } catch (e) {
      return toError(e)
    }
  }

  // ---- Receivables -------------------------------------------------------
  const canSettleReceivables = () => Boolean(user && ['Admin', 'Manager'].includes(user.role))

  // No manual "add account" mutator on purpose — a credit account only ever
  // comes into existence from an unpaid order being put on account
  // (markOrderUdhaar, which creates the Receivable if the name is new).
  const recordReceivablePayment = async (id, amount, { method = 'Cash', notes = '' } = {}) => {
    try {
      const res = await apiPost(`/api/receivables/${id}/payment`, { amount: amount ?? null, method, notes })
      await refresh(['receivables'])
      return { success: true, settled: res.settled }
    } catch (e) {
      return toError(e)
    }
  }

  // ---- Departments -------------------------------------------------------
  const addDepartment = async ({ name, nameUrdu = '', description = '', manager = '', managerId = '' } = {}) => {
    try {
      const { department } = await apiPost('/api/departments', { name, nameUrdu, description, manager, managerId })
      await refresh(['departments'])
      return { success: true, id: department?.id }
    } catch (e) {
      return toError(e)
    }
  }
  const deleteDepartment = async (id) => {
    try {
      await apiDelete(`/api/departments/${id}`)
      await refresh(['departments'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }
  const assignItemToDepartment = async (itemId, departmentId) => {
    try {
      await apiPost(`/api/departments/${departmentId}/items`, { itemId })
      await refresh(['departments'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }
  const removeItemFromDepartment = async (itemId, departmentId) => {
    try {
      await apiDelete(`/api/departments/${departmentId}/items/${itemId}`)
      await refresh(['departments'])
      return { success: true }
    } catch (e) {
      return toError(e)
    }
  }
  const getDepartmentForItem = (itemId) => {
    if (itemId == null) return null
    const baseId = String(itemId).split('::')[0]
    return departments.find((d) => d.items?.includes(baseId)) || null
  }

  const value = {
    user,
    login,
    logout,
    signup,
    changeMyPassword,
    setStaffPassword,
    orders,
    addOrder,
    appendOrderItems,
    markPaid,
    markReady,
    markItemReady,
    clearKitchen,
    cancelOrder,
    orderMaterialLoss,
    updateOrderItemQty,
    shiftOrderTable,
    applyDiscount,
    removeDiscount,
    auditLog,
    orderTotal,
    gstEnabled,
    gstRate,
    setGst,
    setGstRate,
    whatsappReport,
    setWhatsappReportConfig,
    onlineAccounts,
    addOnlineAccount,
    updateOnlineAccount,
    toggleOnlineAccount,
    dailyClosings,
    lastClosingAt,
    saveDailyClosing,
    attendance,
    overrideAttendance,
    inventory,
    lowStock,
    adjustStock,
    restock,
    recordPurchase,
    purchases,
    addInventoryItem,
    transactions,
    addTransaction,
    deleteTransaction,
    recipes,
    createRecipe,
    updateRecipe,
    deleteRecipe,
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
    bulkAddTables,
    updateTable,
    deleteTable,
    renameTableCategory,
    updateTableCategory,
    deleteTableCategory,
    staff,
    waiters,
    addStaff,
    updateStaff,
    deleteStaff,
    toggleStaff,
    pendingSignups,
    approveSignup,
    rejectSignup,
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
    forwardHandover,
    acceptHandover,
    rejectHandover,
    receivables,
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
    canSettleReceivables,
  }

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink text-cream-dim">
        <div className="animate-pulse text-sm tracking-widest">Loading…</div>
      </div>
    )
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
