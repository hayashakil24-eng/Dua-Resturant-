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
  const [staff, setStaff] = useState(STAFF)
  const [advances, setAdvances] = useState(INITIAL_ADVANCES)
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS)
  const [auditLog, setAuditLog] = useState([])
  const [orderSeq, setOrderSeq] = useState(1046)
  const [txnSeq, setTxnSeq] = useState(500)
  // Cash drawer reconciliation: the cashier's open shift plus the closed
  // shifts (kept for the Admin/Manager dashboard).
  const [shiftReconciliations, setShiftReconciliations] = useState([])
  const [activeShift, setActiveShift] = useState(null)

  const login = ({ role, name }) => setUser({ role, name: name || `${role} User` })
  const logout = () => setUser(null)

  // Bill breakdown for a set of line items. `discount` is a flat Rs. amount
  // taken off the gross total (subtotal + tax); clamped so the bill never
  // goes negative. Existing callers that omit it are unaffected.
  const orderTotal = (items, discount = 0) => {
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0)
    const tax = Math.round(subtotal * TAX_RATE)
    const gross = subtotal + tax
    const discountAmt = Math.min(Math.max(0, Number(discount) || 0), gross)
    return { subtotal, tax, discount: discountAmt, total: gross - discountAmt }
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

  // Admin/Manager only — apply a flat discount to an order with a reason +
  // audit entry. Clamped to the bill total so it can never go negative.
  const applyDiscount = (id, { amount, reason = '', notes = '' } = {}) => {
    let recorded = null
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id || o.cancelled) return o
        const { total } = orderTotal(o.items) // gross bill, before any discount
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
  const shiftSalesSince = (startISO) => {
    const start = new Date(startISO)
    let totalCashSales = 0
    let totalCardSales = 0
    orders.forEach((o) => {
      if (o.payment !== 'Paid' || o.cancelled) return
      if (new Date(o.createdAt) < start) return
      const total = orderTotal(o.items, o.discount?.amount).total
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
    const { totalCashSales, totalCardSales } = shiftSalesSince(shift.shiftStartTime)
    return {
      totalCashSales,
      totalCardSales,
      expectedCash: shift.openingCash + totalCashSales,
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

  // Close a shift against a physical cash count. difference = expected − actual
  // (positive → shortage, negative → excess). Within Rs. 10 counts as matched.
  const endShift = (shiftId, actualCash) => {
    const sales = calculateShiftSales(shiftId)
    if (!sales) return null
    const actual = Math.max(0, Number(actualCash) || 0)
    const difference = sales.expectedCash - actual
    const status =
      Math.abs(difference) < 10 ? 'matched' : difference > 0 ? 'shortage' : 'excess'

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
          at: closed.shiftEndTime,
        },
        ...prev,
      ])
    }
    return closed
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
      .reduce((s, o) => s + orderTotal(o.items, o.discount?.amount).total, 0)
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
    applyDiscount,
    removeDiscount,
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
    endShift,
    calculateShiftSales,
    stats,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
