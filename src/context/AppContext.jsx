import { createContext, useContext, useMemo, useState } from 'react'
import {
  INITIAL_ORDERS,
  INITIAL_ATTENDANCE,
  INVENTORY,
  INITIAL_TRANSACTIONS,
  INITIAL_MENU,
  MENU_CATEGORIES,
  INITIAL_ADVANCES,
  TABLES,
  STAFF,
  TAX_RATE,
} from '../data/mockData.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null) // { name, role }
  const [orders, setOrders] = useState(INITIAL_ORDERS)
  const [attendance, setAttendance] = useState(INITIAL_ATTENDANCE)
  const [inventory, setInventory] = useState(INVENTORY)
  const [menu, setMenu] = useState(INITIAL_MENU)
  const [tables, setTables] = useState(TABLES)
  const [advances, setAdvances] = useState(INITIAL_ADVANCES)
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS)
  const [auditLog, setAuditLog] = useState([])
  const [orderSeq, setOrderSeq] = useState(1046)
  const [txnSeq, setTxnSeq] = useState(500)

  const login = ({ role, name }) => setUser({ role, name: name || `${role} User` })
  const logout = () => setUser(null)

  const orderTotal = (items) => {
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0)
    const tax = Math.round(subtotal * TAX_RATE)
    return { subtotal, tax, total: subtotal + tax }
  }

  const addOrder = ({ table, waiter, items, payment, method }) => {
    const id = `ORD-${orderSeq}`
    const newOrder = {
      id,
      table,
      waiter,
      items,
      payment,
      method: payment === 'Paid' ? method : '—',
      kitchen: 'Pending',
      createdAt: new Date().toISOString(),
    }
    setOrders((prev) => [newOrder, ...prev])
    setOrderSeq((n) => n + 1)
    return newOrder
  }

  const markPaid = (id, method = 'Cash') =>
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, payment: 'Paid', method } : o)),
    )

  // Manager/Admin only — cancel an UNPAID order with a reason + audit entry.
  const cancelOrder = (id, { reason, notes = '' } = {}) => {
    let recorded = null
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id || o.payment !== 'Unpaid' || o.cancelled) return o
        recorded = {
          reason,
          notes,
          by: user?.name || 'Unknown',
          role: user?.role || '—',
          at: new Date().toISOString(),
        }
        return { ...o, cancelled: true, cancellation: recorded }
      }),
    )
    if (recorded) {
      setAuditLog((prev) => [
        { id: `AUD-${Date.now()}`, orderId: id, action: 'CANCELLED', ...recorded },
        ...prev,
      ])
    }
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

  const checkIn = (staffId) =>
    setAttendance((prev) => ({
      ...prev,
      [staffId]: { checkIn: new Date().toISOString(), checkOut: null, status: 'Present' },
    }))

  const checkOut = (staffId) =>
    setAttendance((prev) => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        checkOut: new Date().toISOString(),
        status: 'Checked Out',
      },
    }))

  // Adjust a stock line by a delta (restock or consume); never drops below 0
  const adjustStock = (id, delta) =>
    setInventory((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, stock: Math.max(0, i.stock + delta) } : i,
      ),
    )

  const restock = (id, amount = 10) => adjustStock(id, Math.abs(amount))

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
    const num = Number(id)
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
  const deleteTable = (id) => setTables((prev) => prev.filter((t) => t.id !== id))

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

  // Categories present in the menu, in canonical order (extras appended).
  const menuCategories = useMemo(() => {
    const present = [...new Set(menu.map((m) => m.category))]
    const ordered = MENU_CATEGORIES.filter((c) => present.includes(c))
    const extras = present.filter((c) => !MENU_CATEGORIES.includes(c))
    return [...ordered, ...extras]
  }, [menu])

  // Items at or below their threshold — drives low-stock alerts
  const lowStock = useMemo(
    () => inventory.filter((i) => i.stock <= i.threshold),
    [inventory],
  )

  // Derived stats for dashboard
  const stats = useMemo(() => {
    const revenue = orders
      .filter((o) => o.payment === 'Paid' && !o.cancelled)
      .reduce((s, o) => s + orderTotal(o.items).total, 0)
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
      totalStaff: STAFF.length,
      lowStockCount: lowStock.length,
    }
  }, [orders, attendance, lowStock])

  const value = {
    user,
    login,
    logout,
    orders,
    addOrder,
    markPaid,
    markReady,
    clearKitchen,
    cancelOrder,
    auditLog,
    orderTotal,
    attendance,
    checkIn,
    checkOut,
    inventory,
    lowStock,
    adjustStock,
    restock,
    transactions,
    addTransaction,
    deleteTransaction,
    menu,
    menuCategories,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleMenuItem,
    replaceMenu,
    tables,
    addTable,
    updateTable,
    deleteTable,
    advances,
    addAdvance,
    deleteAdvance,
    recoverAdvances,
    stats,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
