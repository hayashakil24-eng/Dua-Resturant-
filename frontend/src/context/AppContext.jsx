import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { INITIAL_ATTENDANCE, MENU_CATEGORIES, TAX_RATE } from '../data/mockData.js'
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
  RECEIVABLE_ADDED: ['receivables'],
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
  // Attendance stays a local mock: the backend has no machine-attendance feed
  // yet (payroll still uses a deterministic generator), so this mirrors the
  // pre-backend behavior. overrideAttendance persists to the backend AND updates
  // this local view for immediate display. See docs/02-phase-1.
  const [attendance, setAttendance] = useState(INITIAL_ATTENDANCE)

  // --- Data loading -------------------------------------------------------
  // One fetcher per collection; refresh(keys) pulls a subset after a mutation.
  const FETCHERS = {
    orders: () => apiGet('/api/orders').then((d) => setOrders((d.orders || []).map(normalizeOrder))),
    inventory: () => apiGet('/api/inventory').then((d) => setInventory(d.inventory || [])),
    menu: () => apiGet('/api/menu').then((d) => setMenu(d.menu || [])),
    categories: () => apiGet('/api/categories').then((d) => setCustomCategories(d.categories || [])),
    tables: () => apiGet('/api/tables').then((d) => setTables(d.tables || [])),
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
  const addOnlineAccount = async ({ name, type, number = '' } = {}) => {
    try {
      const { account } = await apiPost('/api/online-accounts', { name, type, number })
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
  const clearKitchen = async (id) => {
    try {
      await apiPost(`/api/orders/${orderSid(id)}/served`)
      await refresh(['orders'])
    } catch (e) {
      return toError(e)
    }
  }

  const cancelOrder = async (id, { reason, notes = '' } = {}) => {
    try {
      await apiPost(`/api/orders/${orderSid(id)}/cancel`, { reason, notes })
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

  const applyDiscount = async (id, { amount, reason = '', notes = '' } = {}) => {
    try {
      await apiPost(`/api/orders/${orderSid(id)}/discount`, { amount, reason, notes })
      await refresh(['orders'])
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
  const addTable = async ({ id, number, seats, section }) => {
    try {
      await apiPost('/api/tables', { id: Number(id), number, seats, section })
      await refresh(['tables'])
    } catch (e) {
      return toError(e)
    }
  }
  const updateTable = async (id, updates) => {
    try {
      await apiPatch(`/api/tables/${id}`, updates)
      await refresh(['tables'])
    } catch (e) {
      return toError(e)
    }
  }
  const deleteTable = async (id) => {
    try {
      await apiDelete(`/api/tables/${id}`)
      await refresh(['tables'])
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
  const recoverAdvances = async (year, monthIndex) => {
    try {
      await apiPost('/api/advances/recover', { year, monthIndex })
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
    const shift = activeShift?.id === shiftId ? activeShift : shiftReconciliations.find((s) => s.id === shiftId)
    if (!shift) return null
    const { totalCashSales, totalCardSales } = shiftSalesForShift(shift.id)
    // Accepted handovers left the drawer, reducing accountable cash.
    const handedOver = pendingHandovers
      .filter((h) => h.shiftId === shift.id && h.status === 'accepted')
      .reduce((s, h) => s + h.amount, 0)
    return { totalCashSales, totalCardSales, handedOver, expectedCash: shift.openingCash + totalCashSales - handedOver }
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
      await refresh(['shifts', 'activeShift'])
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

  // ---- Attendance (local view + backend override) ------------------------
  const overrideAttendance = async (staffId, { checkIn, checkOut, reason, notes = '' } = {}) => {
    if (!reason) return
    try {
      await apiPost(`/api/attendance/${staffId}/override`, { checkIn, checkOut, reason, notes })
    } catch (e) {
      return toError(e)
    }
    const status = checkOut ? 'Checked Out' : checkIn ? 'Present' : 'Absent'
    setAttendance((prev) => ({
      ...prev,
      [staffId]: {
        checkIn: checkIn ?? prev[staffId]?.checkIn ?? null,
        checkOut: checkOut ?? prev[staffId]?.checkOut ?? null,
        status,
        source: 'manual',
        manualEntry: { enteredBy: user?.name || 'Unknown', role: user?.role || '—', reason, notes, enteredAt: new Date().toISOString() },
      },
    }))
  }

  // ---- Receivables -------------------------------------------------------
  const canSettleReceivables = () => Boolean(user && ['Admin', 'Manager'].includes(user.role))

  const addReceivable = async ({ name, amount, type = 'customer', notes = '' } = {}) => {
    try {
      const { receivable } = await apiPost('/api/receivables', { name, amount, type, notes })
      await refresh(['receivables'])
      return { success: true, id: receivable?.id }
    } catch (e) {
      return toError(e)
    }
  }
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
    orders,
    addOrder,
    appendOrderItems,
    markPaid,
    markReady,
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
    updateTable,
    deleteTable,
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
