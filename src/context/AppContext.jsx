import { createContext, useContext, useMemo, useState } from 'react'
import {
  INITIAL_ORDERS,
  INITIAL_ATTENDANCE,
  INVENTORY,
  INITIAL_TRANSACTIONS,
  INITIAL_MENU,
  MENU_CATEGORIES,
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
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS)
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
      .filter((o) => o.payment === 'Paid')
      .reduce((s, o) => s + orderTotal(o.items).total, 0)
    const pending = orders.filter((o) => o.payment === 'Unpaid').length
    const activeTables = new Set(
      orders.filter((o) => o.payment === 'Unpaid').map((o) => o.table),
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
    stats,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
