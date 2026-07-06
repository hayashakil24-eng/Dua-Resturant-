import { createContext, useContext, useMemo, useState } from 'react'
import {
  INITIAL_ORDERS,
  INITIAL_ATTENDANCE,
  STAFF,
  TAX_RATE,
} from '../data/mockData.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null) // { name, role }
  const [orders, setOrders] = useState(INITIAL_ORDERS)
  const [attendance, setAttendance] = useState(INITIAL_ATTENDANCE)
  const [orderSeq, setOrderSeq] = useState(1046)

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
    }
  }, [orders, attendance])

  const value = {
    user,
    login,
    logout,
    orders,
    addOrder,
    markPaid,
    orderTotal,
    attendance,
    checkIn,
    checkOut,
    stats,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
