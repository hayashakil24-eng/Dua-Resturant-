import { createContext, useContext, useMemo, useState } from 'react'
import {
  INITIAL_ORDERS,
  INITIAL_ATTENDANCE,
  INVENTORY,
  INITIAL_TRANSACTIONS,
  INITIAL_MENU,
  MENU_CATEGORIES,
  INITIAL_ADVANCES,
  INITIAL_RECIPES,
  TABLES,
  STAFF,
  TAX_RATE,
} from '../data/mockData.js'
import { canModify } from '../config/permissions.js'
import { convertUnit, calculateDeductions, calculateRestocks } from '../utils/inventoryFlow.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null) // { name, role }
  const [orders, setOrders] = useState(INITIAL_ORDERS)
  const [attendance, setAttendance] = useState(INITIAL_ATTENDANCE)
  const [inventory, setInventory] = useState(INVENTORY)
  const [menu, setMenu] = useState(INITIAL_MENU)
  const [customCategories, setCustomCategories] = useState([]) // free-text categories with no items yet
  const [tables, setTables] = useState(TABLES)
  const [staff, setStaff] = useState(STAFF)
  const [advances, setAdvances] = useState(INITIAL_ADVANCES)
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS)
  const [recipes, setRecipes] = useState(INITIAL_RECIPES)
  const [ingredientRequests, setIngredientRequests] = useState([])
  const [auditLog, setAuditLog] = useState([])
  // Most Ordered is a manually-curated, shared list of menu item ids (NOT
  // auto-calculated from order history). Any POS role (Cashier/Admin/Manager)
  // can add/remove items and the change is global — everyone sees the same list.
  const [mostOrderedItemIds, setMostOrderedItemIds] = useState(['cd1', 'sl3', 'sk1', 'jc1'])
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
    const recipe = {
      id: `RCP-${Date.now()}`,
      menuItemId,
      menuItemName,
      ingredients,
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

  const markPaid = (id, method = 'Cash') =>
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, payment: 'Paid', method } : o)),
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
  const cancelOrder = (id, { reason, notes = '' } = {}) => {
    if (!user || !canModify(user.role, 'orderCancel')) return
    const orderToCancel = orders.find((o) => o.id === id)
    if (!orderToCancel || orderToCancel.payment !== 'Unpaid' || orderToCancel.cancelled) return

    const recorded = {
      reason,
      notes,
      by: user?.name || 'Unknown',
      role: user?.role || '—',
      at: new Date().toISOString(),
    }

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o
        return { ...o, cancelled: true, cancellation: recorded }
      }),
    )

    // Restock the cancelled order items
    restockInventoryForOrder(orderToCancel.items)

    setAuditLog((prev) => [
      { id: `AUD-${Date.now()}`, orderId: id, action: 'CANCELLED', ...recorded },
      ...prev,
    ])
  }

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
  const addInventoryItem = ({ name, category, unit, stock = 0, threshold = 0 } = {}) => {
    if (!user || !canModify(user.role, 'inventoryCreate')) {
      return { error: 'Only Admin can add new inventory items.' }
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
      category: (category || 'Other').trim() || 'Other',
      stock: Math.max(0, Number(stock) || 0),
      unit: unit || 'kg',
      threshold: Math.max(0, Number(threshold) || 0),
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
    appendOrderItems,
    markPaid,
    markReady,
    clearKitchen,
    cancelOrder,
    updateOrderItemQty,
    applyDiscount,
    removeDiscount,
    auditLog,
    orderTotal,
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
