import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/ui.jsx'
import { money, time, formatQty } from '../utils/format.js'
import { Receipt } from './Billing.jsx'
import PaymentModal from '../components/PaymentModal.jsx'
import ManageMostOrderedModal from '../components/ManageMostOrderedModal.jsx'
import DeliveryDetailsModal from '../components/DeliveryDetailsModal.jsx'
import KitchenSlips from '../components/KitchenSlips.jsx'
import { safePrint, printKotRaw } from '../utils/print.js'
import { buildKotEscPos } from '../utils/escpos.js'
import { groupOrderItemsByDepartment } from '../utils/kot.js'
import { getRecipeStock, getStockShortfall } from '../utils/inventoryFlow.js'
import { canModify } from '../config/permissions.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { tableLabel } from '../data/mockData.js'
import AddTransactionModal from '../components/AddTransactionModal.jsx'
import {
  IconPlus,
  IconMinus,
  IconTrash,
  IconSearch,
  IconCash,
  IconCheck,
  IconClose,
  IconReceipt,
} from '../components/Icons.jsx'

// Build a compact page list with ellipses, e.g. [1, '…', 4, 5, 6, '…', 12].
// Always keeps first/last and a window around the current page.
function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push('…')
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < total - 1) pages.push('…')
  pages.push(total)
  return pages
}

function Toast({ order, onClose }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-up">
      <div className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-ink-card px-5 py-3 shadow-lift">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gold-grad text-ink">
          <IconCheck size={18} />
        </span>
        <div>
          <p className="text-sm font-semibold text-cream">Order {order.id} placed</p>
          <p className="text-xs text-cream-dim">
            {tableLabel(order.table)} · {order.waiter || '—'} · {order.payment}
          </p>
        </div>
        <button onClick={onClose} className="ml-3 text-xs text-gold hover:underline">
          Dismiss
        </button>
      </div>
    </div>
  )
}

function MenuImage({ item }) {
  const [error, setError] = useState(false)

  if (item.image && !error) {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-ink-line">
        <img
          src={item.image}
          alt={item.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setError(true)}
        />
        <span className="absolute left-2 top-2 rounded-lg bg-ink/75 px-2 py-0.5 text-xs backdrop-blur-sm">
          {item.emoji}
        </span>
      </div>
    )
  }

  // Plain solid-color placeholder layout (no icons, no emojis, matching gold/black theme)
  return (
    <div className="relative aspect-[4/3] w-full rounded-xl bg-ink-soft border border-ink-line shadow-inner" />
  )
}

// "Best sellers" — a manually-curated, shared list (see AppContext). The
// whole card is tappable to quick-add, same as the main menu grid below —
// the "+ Add" pill is a status label, not a separate nested button.
function MostOrderedCard({ item, onAdd }) {
  const [added, setAdded] = useState(false)
  // Boolean, not the raw length: an empty variants array (0) would otherwise
  // render literally in JSX (`{0 && …}` prints "0") — the "0Rs. 550" bug.
  const hasVariants = Boolean(item.variants && item.variants.length)
  const click = () => {
    onAdd(item)
    setAdded(true)
    setTimeout(() => setAdded(false), 700)
  }
  return (
    <button
      onClick={click}
      className="w-32 shrink-0 overflow-hidden rounded-xl border border-gold/30 bg-ink-card text-left transition hover:border-gold/60 hover:shadow-gold"
    >
      <MenuImage item={item} />
      <div className="p-2">
        <p className="truncate text-xs font-semibold text-cream">{item.name}</p>
        <p className="font-serif text-xs text-gold">
          {hasVariants && 'from '}
          {money(item.price)}
        </p>
        <span
          className={`mt-2 block w-full rounded-lg py-1 text-center text-xs font-bold transition ${
            added ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gold-grad text-ink'
          }`}
        >
          {added ? '✓ Added' : '+ Add'}
        </span>
      </div>
    </button>
  )
}

// Manually-curated shared list. Any authorised POS user can open Manage to
// add/remove items; the list is global (same for everyone).
function MostOrdered({ items, onAdd, canManage, onManage }) {
  return (
    <div className="mb-5 mt-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="font-serif text-xl text-cream">⭐ Most Ordered</h2>
          <span className="text-xs text-cream-dim">Quick-add your best sellers</span>
        </div>
        {canManage && (
          <button onClick={onManage} className="btn-ghost px-3 py-1.5 text-xs">
            ⚙️ Manage
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card p-6 text-center text-sm text-cream-dim">
          No items added yet.
          {canManage ? ' Click “⚙️ Manage” to add your best sellers.' : ''}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {items.map((item) => (
            <MostOrderedCard key={item.id} item={item} onAdd={onAdd} />
          ))}
        </div>
      )}
      <div className="mt-4 border-t border-ink-line" />
    </div>
  )
}

// Quick size/type chooser for items that have variants (Pizza, Steaks).
function VariantModal({ item, onPick, onClose }) {
  useEscapeKey(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-xl text-cream">{item.name}</h3>
              <p className="mt-0.5 text-xs text-cream-dim">Choose an option</p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>
          <div className="mt-5 space-y-2">
            {item.variants.map((v) => (
              <button
                key={v.label}
                onClick={() => onPick(v)}
                className="flex w-full items-center justify-between rounded-xl border border-ink-line bg-ink-soft px-4 py-3 text-left transition hover:border-gold/50 hover:bg-gold/5"
              >
                <span className="text-sm font-semibold text-cream">{v.label}</span>
                <span className="font-serif text-lg text-gold">{money(v.price)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Weight entry for kg-billed items (Karahi, Handi, some BBQ) — replaces the
// variant picker for these items: price is per kg, so the cashier types the
// exact weight instead of tapping +1. Sibling of VariantModal above.
function WeightModal({ item, initial, onAdd, onClose }) {
  const [value, setValue] = useState(initial ? String(initial) : '')
  useEscapeKey(onClose)
  const n = Number(value)
  const valid = value !== '' && Number.isFinite(n) && n >= 0.05
  const submit = () => {
    if (!valid) return
    onAdd(Math.round(n * 100) / 100)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-xl text-cream">{item.name}</h3>
              <p className="mt-0.5 text-xs text-cream-dim">{money(item.price)}/kg — enter the weight</p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>
          <div className="mt-5">
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">Weight (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              step={0.05}
              min={0.05}
              autoFocus
              className="input text-center text-lg font-semibold"
              placeholder="e.g. 1.5"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            {value !== '' && !valid && (
              <p className="mt-1.5 text-xs text-rose-300">Enter a weight of at least 0.05kg.</p>
            )}
            {valid && <p className="mt-1.5 text-xs text-cream-dim">Line total: {money(Math.round(item.price * n))}</p>}
          </div>
          <button
            onClick={submit}
            disabled={!valid}
            className="btn-gold mt-5 w-full py-3 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconCheck size={18} /> {initial ? 'Update weight' : 'Add to cart'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function POS() {
  const {
    addOrder,
    appendOrderItems,
    orderTotal,
    orders,
    menu,
    menuCategories,
    tables,
    waiters,
    user,
    inventory,
    recipes,
    getMostOrderedItems,
    onlineAccounts,
    gstRate,
    addTransaction,
    getDepartmentForItem,
  } = useApp()

  // Recipe-based stock status per menu item (only items with an approved recipe
  // are constrained; everything else is unconstrained). Recomputed as inventory
  // is auto-deducted by orders.
  const stockByItem = useMemo(() => {
    const map = {}
    menu.forEach((m) => {
      // Gate on the smallest option the item sells in, not a whole portion —
      // otherwise a karahi with enough stock for a Half but not a Full would be
      // disabled outright. Over-ordering is still caught by getStockShortfall
      // at checkout (and server-side), which is portion-exact.
      const smallest = m.variants?.length
        ? Math.min(...m.variants.map((v) => (Number(v.portion) > 0 ? Number(v.portion) : 1)))
        : 1
      map[m.id] = getRecipeStock(m.id, inventory, recipes, smallest)
    })
    return map
  }, [menu, inventory, recipes])
  const location = useLocation()
  const navigate = useNavigate()
  const [cat, setCat] = useState('All')
  const [query, setQuery] = useState('')
  const catScrollRef = useRef(null)
  const scrollCategories = (dir) =>
    catScrollRef.current?.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' })
  const [cart, setCart] = useState({}) // { lineKey: qty }, lineKey = id or `id::variant`
  const [editingQtyKey, setEditingQtyKey] = useState(null) // cart line whose qty is being typed in
  const [editingQtyValue, setEditingQtyValue] = useState('')
  const [variantPick, setVariantPick] = useState(null) // menu item awaiting a variant
  const [weightPick, setWeightPick] = useState(null) // kg-billed menu item awaiting a weight
  const [showManageMostOrdered, setShowManageMostOrdered] = useState(false)
  const [deliveryDetails, setDeliveryDetails] = useState(null)
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const mostOrderedItems = getMostOrderedItems()
  const canManageMostOrdered = user ? canModify(user.role, 'mostOrderedManage') : false
  // Cashier's quick-add-expense: a narrow create-only slice of 'accounting'
  // (see config/permissions.js's expenseEntry) so Cashier can log a daily
  // expense/maintenance entry without seeing the full ledger (Accounting
  // page stays hidden to them).
  const canAddExpense = user ? canModify(user.role, 'expenseEntry') : false

  // Running bill: when arriving with a continueOrderId, we append to that
  // existing unpaid order instead of starting a fresh one.
  const continueId = location.state?.continueOrderId || null
  const continuingOrder = useMemo(
    () => (continueId ? orders.find((o) => o.id === continueId && !o.cancelled) : null),
    [continueId, orders],
  )
  const isContinuing = Boolean(continuingOrder)

  // Pre-selected from the Tables page (start an order on this table, or the
  // table of the order we're adding to).
  const [table, setTable] = useState(() => {
    if (continuingOrder) return String(continuingOrder.table)
    return location.state?.presetTable ? String(location.state.presetTable) : ''
  })
  const [waiter, setWaiter] = useState(() => continuingOrder?.waiter || '')
  const [showPayment, setShowPayment] = useState(false)
  const [activeReceipt, setActiveReceipt] = useState(null)
  const [toast, setToast] = useState(null)
  const [kotOrder, setKotOrder] = useState(null) // just-placed order → department kitchen slips
  const [error, setError] = useState('')

  const activeMenu = useMemo(() => menu.filter((m) => m.active !== false), [menu])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return activeMenu.filter(
      (m) =>
        (cat === 'All' || m.category === cat) &&
        (!q || m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)),
    )
  }, [activeMenu, cat, query])

  // Paginate the menu grid so the page doesn't grow unbounded with ~70 items —
  // one screenful per page instead of a long scroll.
  const PAGE_SIZE = 20
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  // Reset to the first page whenever the result set changes (category/search).
  useEffect(() => {
    setPage(1)
  }, [cat, query])
  // Clamp if the current page falls out of range (e.g. after a filter narrows).
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )

  // Resolve a cart line key ("id" or "id::variant") to a priced line item.
  const resolveLine = (key, qty) => {
    const [id, label] = key.split('::')
    const base = menu.find((m) => m.id === id)
    if (!base) return null
    const variant = label ? (base.variants || []).find((v) => v.label === label) : null
    return {
      key,
      id,
      name: label ? `${base.name} (${label})` : base.name,
      price: variant ? variant.price : base.price,
      // Snapshot cost with the line: it is what the item cost us at the time of
      // sale, so later menu re-costing must not rewrite historical orders.
      cost: variant ? variant.cost : base.cost,
      costEstimated: base.costEstimated,
      // Share of the recipe this line consumes (Half = 0.5). Carried on the
      // line so the pre-checkout stock check below scales the same way the
      // server's deduction will; the server re-reads it from the variant, so
      // this copy only drives the local check.
      portion: variant?.portion ?? 1,
      emoji: base.emoji,
      unit: base.unit || 'pcs',
      qty,
    }
  }

  const items = Object.entries(cart)
    .map(([key, qty]) => resolveLine(key, qty))
    .filter((i) => i && i.qty > 0)

  // Billing unit for an already-placed order line — order items don't carry
  // their own unit, only the menu item they were sold from does.
  const unitOf = (menuItemId) => menu.find((m) => m.id === menuItemId)?.unit || 'pcs'

  const { subtotal, tax, total } = orderTotal(items)

  // Tables currently occupied by an active (unpaid) order — shown as "In Use".
  const occupiedTables = useMemo(
    () =>
      new Set(orders.filter((o) => o.payment === 'Unpaid' && !o.cancelled).map((o) => o.table)),
    [orders],
  )

  // Physical table categories derived LIVE from the tables (special order-type
  // tables are listed separately), so renamed/deleted categories reflect here.
  const physicalCats = useMemo(
    () => [...new Set(tables.filter((tb) => !tb.orderType).map((tb) => tb.category).filter(Boolean))].sort(),
    [tables],
  )

  // Delivery/Takeaway are pseudo-tables (orderType set) with no floor to serve,
  // so there is no waiter to assign — the field is disabled and the order goes
  // out unassigned rather than pinning it on whoever happened to be picked.
  const isOffPremise = Boolean(tables.find((t) => t.id === Number(table))?.orderType)
  const isDeliverySelected = tables.find((t) => t.id === Number(table))?.orderType === 'delivery'

  // The selected table already has a running order → a second separate order
  // isn't allowed (add to it instead). One source of truth for the warning,
  // the disabled checkout buttons, and validate(). Delivery/Takeaway (orderType)
  // are exempt; not relevant when continuing (appending to that same order).
  const selectedTableBusy =
    !isContinuing &&
    Boolean(table) &&
    !tables.find((t) => t.id === Number(table))?.orderType &&
    occupiedTables.has(Number(table))

  // Once a table is chosen AND items are on the order, lock the table until
  // checkout. Locking only after a table is picked avoids stranding an
  // items-first order (the selector stays usable until a table is set).
  // Excludes a busy table — that selection can never be checked out as-is
  // (see selectedTableBusy), so locking it too used to trap the cashier:
  // the only way out was clearing the whole cart just to re-enable the
  // dropdown and pick a free table.
  const tableLocked = isContinuing || (items.length > 0 && Boolean(table) && !selectedTableBusy)
  const [lockedAt, setLockedAt] = useState(null)
  useEffect(() => {
    setLockedAt((prev) => (tableLocked ? prev || new Date() : null))
  }, [tableLocked])

  // Keep vertical mouse-wheel over the category row from scrolling the whole
  // page: when the row can scroll sideways, translate wheel-Y into horizontal
  // scroll and swallow the event. A native non-passive listener is required
  // because React's onWheel is passive (preventDefault would be ignored).
  useEffect(() => {
    const el = catScrollRef.current
    if (!el) return
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth || e.deltaY === 0) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const round2 = (n) => Math.round(n * 100) / 100
  // step defaults to a whole unit (pcs); kg lines step by 0.25kg instead — see
  // the stepper buttons below, which pass the line's own unit.
  const add = (key, step = 1) => setCart((c) => ({ ...c, [key]: round2((c[key] || 0) + step) }))
  const dec = (key, step = 1) =>
    setCart((c) => {
      const q = round2((c[key] || 0) - step)
      const next = { ...c }
      if (q <= 0) delete next[key]
      else next[key] = q
      return next
    })
  const removeItem = (key) =>
    setCart((c) => {
      const next = { ...c }
      delete next[key]
      return next
    })
  const clear = () => setCart({})
  const setQty = (key, qty) => setCart((c) => ({ ...c, [key]: qty }))

  // Double-click-to-type quantity entry (e.g. "Naan × 100" without 99 taps of
  // the + button). Mirrors add/dec's direct setCart writes — no new
  // calculation path, totals/inventory checks recompute the same way they
  // already do whenever cart changes.
  const startEditQty = (it) => {
    setEditingQtyKey(it.key)
    setEditingQtyValue(String(it.qty))
  }
  const cancelEditQty = () => {
    setEditingQtyKey(null)
    setEditingQtyValue('')
  }
  const commitEditQty = () => {
    const key = editingQtyKey
    if (!key) return
    const isKg = items.find((i) => i.key === key)?.unit === 'kg'
    const n = Number(editingQtyValue)
    if (isKg) {
      if (!editingQtyValue || !Number.isFinite(n) || n < 0.05) {
        setError('Enter a valid weight (at least 0.05kg).')
        cancelEditQty()
        return
      }
      setQty(key, Math.round(n * 100) / 100)
    } else {
      if (!editingQtyValue || !Number.isInteger(n) || n < 1) {
        setError('Enter a valid quantity (whole number, 1 or more).')
        cancelEditQty()
        return
      }
      setQty(key, n)
    }
    setError('')
    cancelEditQty()
  }

  // Tapping a menu item: kg-billed items ask for a weight, variant items open
  // the size picker, others add directly.
  const onItemClick = (m) => {
    if (m.unit === 'kg') setWeightPick(m)
    else if (m.variants && m.variants.length) setVariantPick(m)
    else add(m.id)
  }
  const chooseVariant = (m, v) => {
    add(`${m.id}::${v.label}`)
    setVariantPick(null)
  }
  const chooseWeight = (m, kg) => {
    setQty(m.id, kg)
    setWeightPick(null)
  }
  // Total quantity of a menu item across all its variant lines (for the badge).
  const qtyFor = (m) =>
    Object.entries(cart).reduce(
      (s, [key, q]) => (key.split('::')[0] === m.id ? s + q : s),
      0,
    )

  // Returns an error message if the order isn't ready to place, else null.
  const validate = () => {
    if (items.length === 0) return 'Add at least one item to the order.'
    if (!table) return 'Please select a table number.'
    // Safety net behind the disabled checkout buttons: a physical table holds
    // only ONE running order at a time (Delivery/Takeaway exempt via
    // selectedTableBusy). Add to the existing order instead.
    if (selectedTableBusy) {
      const running = orders.find((o) => o.table === Number(table) && o.payment === 'Unpaid' && !o.cancelled)
      return `Table ${tableLabel(Number(table))} already has a running order${running ? ` (${running.id})` : ''} — add items to it from the Tables page, or settle it first.`
    }
    // Delivery/Takeaway have no waiter to assign (the field is disabled), so
    // requiring one here would make those orders impossible to place.
    if (!isOffPremise && !waiter) return 'Please assign a waiter.'
    // Safety net behind the DeliveryDetailsModal — a Delivery order can't be
    // placed without rider/customer/phone/address/charge on file.
    if (isDeliverySelected && !deliveryDetails) return 'Delivery details are required — rider name, customer name, phone, address and charges.'
    // Prevent out-of-stock orders: the cart's recipes must not exceed stock.
    const short = getStockShortfall(
      items.map(({ key, qty, portion }) => ({ id: key, qty, portion })),
      inventory,
      recipes,
    )
    if (short) {
      const r = (n) => Math.round(n * 1000) / 1000
      return `Out of stock: ${short.itemName} — need ${r(short.need)}${short.unit}, have ${r(short.have)}${short.unit}.`
    }
    return null
  }

  const resetForm = () => {
    clear()
    setTable('')
    setWaiter('')
    setDeliveryDetails(null)
  }

  const placeOrder = async ({ payment, method, onlineAccount = null }) => {
    const order = await addOrder({
      table: Number(table),
      // Never send a stale waiter on a Delivery/Takeaway order, even if one was
      // picked before the order type was switched.
      waiter: isOffPremise ? '' : waiter,
      items: items.map(({ key, name, price, qty, cost, costEstimated }) => ({
        id: key,
        name,
        price,
        qty,
        cost,
        costEstimated,
      })),
      payment,
      method,
      onlineAccount,
      // Rider/customer/charge — informational only, never added to the total
      // (confirmed with the client). Omitted entirely for a non-Delivery order.
      ...(isDeliverySelected && deliveryDetails
        ? {
            deliveryRiderName: deliveryDetails.riderName,
            deliveryCustomerName: deliveryDetails.customerName,
            deliveryCharge: Number(deliveryDetails.charge) || 0,
            deliveryPhone: deliveryDetails.phone,
            deliveryAddress: deliveryDetails.address,
            deliveryInstructions: deliveryDetails.instructions,
          }
        : {}),
    })
    if (order?.error) return order
    resetForm()
    return order
  }

  // Print department-wise kitchen slips (one per counter) for an order that
  // was just sent to the kitchen. Raw ESC/POS (see print.js/escpos.js) —
  // same reason as Billing.jsx's receipt: Chromium's silent print pipeline
  // fails outright against real thermal printer drivers on this Electron
  // version. Browser-dev-mode (NO_ELECTRON=1) fallback still renders
  // KitchenSlips.jsx into the DOM and goes through the old print path.
  const printKitchenSlips = (order) => {
    if (!order?.items?.length) return
    const d = new Date(order.createdAt || Date.now())
    const dateStr = d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
    const timeStr = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })
    const { slips, unitOf } = groupOrderItemsByDepartment(order, { getDepartmentForItem, menu })
    printKotRaw(
      () => buildKotEscPos({ order, slips, unitOf, tableLabelText: tableLabel(order.table), dateStr, timeStr, cashierName: user?.name }),
      () => {
        setKotOrder(order)
        setTimeout(() => safePrint('print-kot'), 80)
        return true
      },
    )
  }

  // "Pay Now" — validate, then open the payment modal.
  const openPayment = () => {
    const err = validate()
    if (err) return setError(err)
    setError('')
    setShowPayment(true)
  }

  // Confirmed in the payment modal → mark paid, then auto-open receipt to print.
  // `account` is the online destination when method === 'Online' (else null).
  const confirmPayment = async (method, _amount, account = null) => {
    const order = await placeOrder({ payment: 'Paid', method, onlineAccount: account })
    setShowPayment(false)
    if (order?.error) return setError(order.error)
    printKitchenSlips(order)
    setActiveReceipt(order)
  }

  // "Place as Unpaid" — send to kitchen now, collect payment later at billing.
  const placeUnpaid = async () => {
    const err = validate()
    if (err) return setError(err)
    setError('')
    const order = await placeOrder({ payment: 'Unpaid', method: '—' })
    if (order?.error) return setError(order.error)
    printKitchenSlips(order)
    setToast(order)
    setTimeout(() => setToast(null), 4000)
  }

  // F12 = keyboard shortcut for the "Place as Unpaid" button: submit → print KOT
  // → toast the order id/table → reset the form, without reaching for the mouse.
  // It runs the exact same handler as the button, so validation (needs an item,
  // a table, and a waiter, and enough stock) and its error message are shared —
  // an incomplete order shows the same inline error instead of being placed.
  // A ref holds the latest handler so the one-time listener always sees the
  // current cart/table/waiter rather than a stale closure.
  const placeUnpaidRef = useRef(placeUnpaid)
  placeUnpaidRef.current = placeUnpaid
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'F12') return
      // Only the new-order form (the continuing-bill flow appends instead of
      // creating a new order), never while a modal owns the screen, and not on
      // a busy table (mirrors the disabled Place-as-Unpaid button).
      if (isContinuing || showPayment || variantPick || activeReceipt || selectedTableBusy) return
      e.preventDefault()
      placeUnpaidRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isContinuing, showPayment, variantPick, activeReceipt, selectedTableBusy])

  // Running bill: append the cart's new items to the existing order, then return
  // to the floor. The combined bill is settled later at billing/checkout.
  const addToOrder = async () => {
    if (items.length === 0) return setError('Add at least one new item to append.')
    setError('')
    const newItems = items.map(({ key, name, price, qty, cost, costEstimated }) => ({
      id: key,
      name,
      price,
      qty,
      cost,
      costEstimated,
    }))
    const res = await appendOrderItems(continuingOrder.id, newItems)
    if (res?.error) return setError(res.error)
    // Fire kitchen slips for the appended items only (a fresh KOT per counter).
    // Delay the navigate so the slips render + print before POS unmounts.
    printKitchenSlips({
      id: continuingOrder.id,
      table: continuingOrder.table,
      waiter: continuingOrder.waiter,
      items: newItems,
      createdAt: new Date().toISOString(),
    })
    setTimeout(() => navigate('/tables'), 600)
  }

  const existingTotal = isContinuing ? orderTotal(continuingOrder.items, 0, continuingOrder.gstRate).total : 0

  return (
    <div className="pb-24 lg:pb-0">
      <PageHeader
        title={isContinuing ? `Add to Order · ${continuingOrder.id}` : 'New Order'}
        subtitle={
          isContinuing
            ? `${tableLabel(continuingOrder.table)} · new items append to this running bill.`
            : 'Build the order, assign a table & waiter, then checkout.'
        }
      >
        {canAddExpense && (
          <button onClick={() => setShowAddExpense(true)} className="btn-ghost px-4 py-2 text-sm">
            <IconCash size={16} /> Add Expense
          </button>
        )}
      </PageHeader>

      {showAddExpense && (
        <AddTransactionModal onClose={() => setShowAddExpense(false)} onSave={addTransaction} />
      )}

      {isContinuing && (
        <div className="mb-6 rounded-2xl border border-gold/25 bg-gold/[0.06] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gold">
              🧾 Already on this order ({tableLabel(continuingOrder.table)})
            </p>
            <p className="text-sm text-cream-dim">
              Running total <span className="font-semibold text-cream">{money(existingTotal)}</span>
            </p>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-cream-dim">
            {continuingOrder.items.map((it) => (
              <li key={it.id}>
                {it.name} <span className="text-cream">×{formatQty(it.qty, unitOf(it.menuItemId))}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-cream-dim">
            New items you add below are charged onto the same bill — no second order is created.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Menu side — controls (search, categories) first, then content.
            min-w-0 lets this column shrink to the track instead of expanding to
            its images' intrinsic width (which was blowing the layout wide). */}
        <div className="min-w-0">
          {/* 1. Search — top & prominent, with clear button */}
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cream-dim">
              <IconSearch size={18} />
            </span>
            <input
              className="input w-full rounded-xl py-3 pl-12 pr-11 text-base"
              placeholder="Search menu…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                title="Clear search"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-cream-dim transition hover:text-cream"
              >
                <IconClose size={16} />
              </button>
            )}
          </div>

          {/* 2. Categories — single-line horizontal scroll (desktop arrows, native swipe on touch) */}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => scrollCategories('left')}
              aria-label="Scroll categories left"
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-line bg-ink-soft text-lg leading-none text-gold transition hover:border-gold/50 md:flex"
            >
              ‹
            </button>
            <div
              ref={catScrollRef}
              className="scrollbar-hide flex flex-1 touch-pan-x gap-2 overflow-x-auto overscroll-x-contain scroll-smooth"
            >
              {['All', ...menuCategories].map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                    cat === c
                      ? 'border-gold/60 bg-gold/12 text-gold'
                      : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              onClick={() => scrollCategories('right')}
              aria-label="Scroll categories right"
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-line bg-ink-soft text-lg leading-none text-gold transition hover:border-gold/50 md:flex"
            >
              ›
            </button>
          </div>

          {/* 3. Most Ordered — manually-curated shared list (see AppContext).
              Hidden while searching so results show without extra scrolling. */}
          {query.trim() === '' && (
            <MostOrdered
              items={mostOrderedItems}
              onAdd={onItemClick}
              canManage={canManageMostOrdered}
              onManage={() => setShowManageMostOrdered(true)}
            />
          )}

          {/* 4. Menu items grid — denser columns so more items fit, less scroll */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {paginated.map((m) => {
              const count = qtyFor(m)
              // Boolean, not raw length — `{0 && …}` renders "0" in JSX (the
              // "0Rs. 550" / "Coladas0" bug on items with an empty variants array).
              const hasVariants = Boolean(m.variants && m.variants.length)
              const stock = stockByItem[m.id] || { status: 'none', maxServings: Infinity }
              // Disable when the recipe can't be made at all, or the cart has
              // already claimed every available serving.
              const reachedMax = Number.isFinite(stock.maxServings) && count >= stock.maxServings
              const disabled = stock.status === 'out' || reachedMax
              return (
                <button
                  key={m.id}
                  onClick={() => onItemClick(m)}
                  disabled={disabled}
                  className={`card group relative flex flex-col p-3 text-left transition ${
                    disabled
                      ? 'cursor-not-allowed opacity-45'
                      : 'hover:border-gold/40 hover:shadow-gold'
                  }`}
                >
                  <MenuImage item={m} />

                  <span className="mt-3 line-clamp-2 text-sm font-semibold text-cream">
                    {m.name}
                  </span>
                  <span className="mt-1 text-xs text-cream-dim">
                    {m.category}
                    {hasVariants && ' · options'}
                  </span>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-serif text-base text-gold">
                      {hasVariants && 'from '}
                      {money(m.price)}
                      {m.unit === 'kg' && '/kg'}
                    </span>
                    <span className={`grid h-7 w-7 place-items-center rounded-lg ring-1 transition ${
                      disabled
                        ? 'bg-white/5 text-cream-dim ring-ink-line'
                        : 'bg-gold/10 text-gold ring-gold/20 group-hover:bg-gold-grad group-hover:text-ink'
                    }`}>
                      <IconPlus size={16} />
                    </span>
                  </div>
                  {count > 0 && (
                    <span className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-gold-grad px-1.5 text-xs font-bold text-ink shadow-md">
                      {m.unit === 'kg' ? Math.round(count * 100) / 100 : count}
                    </span>
                  )}
                  {/* Stock status chip (recipe-backed items only) */}
                  {(stock.status === 'out' || reachedMax) ? (
                    <span className="absolute left-2 top-2 rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
                      Out of stock
                    </span>
                  ) : stock.status === 'low' ? (
                    <span className="absolute left-2 top-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
                      Low stock
                    </span>
                  ) : null}
                </button>
              )
            })}
            {filtered.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-cream-dim">
                No items match your search.
              </p>
            )}
          </div>

          {/* Pagination — previous / numbered pages / next. Only shown when the
              result set spills past a single page. */}
          {pageCount > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 text-sm font-medium text-cream-dim transition hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹ Previous
              </button>
              {pageNumbers(page, pageCount).map((p, i) =>
                p === '…' ? (
                  <span key={`gap-${i}`} className="px-2 text-sm text-cream-dim">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-9 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                      p === page
                        ? 'border-gold/60 bg-gold/12 text-gold'
                        : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
                className="rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 text-sm font-medium text-cream-dim transition hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next ›
              </button>
            </div>
          )}
        </div>

        {/* Cart side */}
        <div id="pos-order" className="scroll-mt-20 lg:sticky lg:top-20 lg:h-fit">
          <div className="card flex max-h-[calc(100vh-7rem)] flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-ink-line p-5">
              <h3 className="font-serif text-xl text-cream">
                {isContinuing ? 'New Items to Add' : 'Current Order'}
              </h3>
              {items.length > 0 && (
                <button
                  onClick={clear}
                  className="text-xs font-medium text-rose-300 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Assignment */}
            <div className="shrink-0 border-b border-ink-line p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-cream-dim">
                    Table
                    {tableLocked && <span className="normal-case text-gold">🔒 Locked</span>}
                  </label>
                  <select
                    className={`input py-2 ${tableLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                    value={table}
                    disabled={tableLocked}
                    onChange={(e) => {
                      const next = e.target.value
                      setTable(next)
                      // Switching to Delivery/Takeaway drops any waiter already
                      // picked, so a disabled field can never still submit one.
                      if (tables.find((t) => t.id === Number(next))?.orderType) setWaiter('')
                      // Delivery needs rider/customer/address details up front —
                      // pre-filled with whatever was already entered, in case the
                      // cashier switched away and back before checking out.
                      if (tables.find((t) => t.id === Number(next))?.orderType === 'delivery') setShowDeliveryModal(true)
                    }}
                  >
                    <option value="">Select table or order type</option>
                    {/* Special order types first, then physical tables by category */}
                    <optgroup label="🚗 Special Orders">
                      {tables
                        .filter((tb) => tb.orderType)
                        .map((tb) => (
                          <option key={tb.id} value={tb.id}>
                            {tb.orderType === 'delivery' ? '🚗 Delivery' : '🛍️ Takeaway'}
                          </option>
                        ))}
                    </optgroup>
                    {physicalCats.map((c) => (
                      <optgroup
                        key={c}
                        label={c === 'HUT' ? '📍 HUT (Outdoor)' : /^[A-Z]$/.test(c) ? `📍 Category ${c}` : `📍 ${c}`}
                      >
                        {tables
                          .filter((tb) => tb.category === c)
                          .map((tb) => (
                            <option key={tb.id} value={tb.id}>
                              {tb.number} · {tb.seats} seats{occupiedTables.has(tb.id) ? ' (In Use)' : ''}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                  {/* A busy physical table can't take a second order — one warning
                      here + disabled checkout buttons (below) say it cleanly. */}
                  {selectedTableBusy && (
                    <p className="mt-1.5 text-xs text-amber-300">
                      ⚠️ {tableLabel(Number(table))} is already in use — add to its order from Tables, or pick a free table.
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                    Waiter
                  </label>
                  <select
                    className={`input py-2 ${isOffPremise ? 'cursor-not-allowed opacity-50' : ''}`}
                    value={isOffPremise ? '' : waiter}
                    disabled={isOffPremise}
                    onChange={(e) => setWaiter(e.target.value)}
                  >
                    <option value="">{isOffPremise ? 'Not needed' : 'Assign'}</option>
                    {waiters.map((w) => (
                      <option key={w.id} value={w.name}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {tableLocked && !selectedTableBusy && (
                // Compact single-line banner: the tall multi-line version stole
                // enough vertical space from the (max-height-capped) card that
                // the items list collapsed to ~one row, hiding added items.
                <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-gold/25 bg-gold/[0.06] px-2.5 py-1.5 text-[11px] leading-snug text-gold">
                  🔒 Locked to {tableLabel(table)}
                  {lockedAt ? ` · ${time(lockedAt.toISOString())}` : ''} — remove all items or checkout to switch tables.
                </p>
              )}
            </div>

            {/* Items — flex-1 so the list scrolls and yields space to the pinned
                totals/checkout buttons on short screens (a fixed min-height here
                pushed the checkout buttons below the viewport). The empty-cart
                placeholder below has no fixed height of its own for the same
                reason — a h-40 minimum was enough, combined with the header,
                assignment and totals sections, to push "Place as Unpaid" past
                the bottom of the viewport on shorter windows. */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {items.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-cream-dim">Cart is empty</p>
                  <p className="mt-1 text-xs text-cream-dim">
                    Tap menu items to add them.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {items.map((it) => (
                    <li
                      key={it.key}
                      className="rounded-xl border border-ink-line bg-ink-soft/40 p-3"
                    >
                      {/* Name (full width, wraps) + remove */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          {it.emoji && <span className="text-xl leading-none">{it.emoji}</span>}
                          <div className="min-w-0">
                            <p className="break-words text-sm font-medium text-cream">{it.name}</p>
                            <p className="text-xs text-cream-dim">{money(it.price)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeItem(it.key)}
                          className="shrink-0 text-cream-dim transition hover:text-rose-300"
                          title="Remove item"
                        >
                          <IconTrash size={16} />
                        </button>
                      </div>

                      {/* Qty stepper + line total. Kg lines step by 0.25kg and
                          allow a decimal typed value; pcs lines keep the
                          original whole-number-only behavior. */}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => dec(it.key, it.unit === 'kg' ? 0.25 : 1)}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-ink-line text-cream-dim hover:text-cream"
                          >
                            <IconMinus size={14} />
                          </button>
                          {editingQtyKey === it.key ? (
                            <input
                              type="text"
                              inputMode={it.unit === 'kg' ? 'decimal' : 'numeric'}
                              autoFocus
                              maxLength={6}
                              value={editingQtyValue}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) =>
                                setEditingQtyValue(
                                  it.unit === 'kg'
                                    ? e.target.value.replace(/[^0-9.]/g, '')
                                    : e.target.value.replace(/[^0-9]/g, ''),
                                )
                              }
                              onBlur={commitEditQty}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  commitEditQty()
                                } else if (e.key === 'Escape') {
                                  e.preventDefault()
                                  cancelEditQty()
                                }
                              }}
                              className="w-14 rounded-lg border border-ink-line bg-ink-soft px-1 py-0.5 text-center text-sm font-semibold text-cream outline-none focus:border-gold/70 focus:ring-2 focus:ring-gold/20"
                            />
                          ) : (
                            <span
                              onDoubleClick={() => startEditQty(it)}
                              title="Double-click to type a quantity"
                              className="cursor-text whitespace-nowrap text-center text-sm font-semibold text-cream"
                            >
                              {formatQty(it.qty, it.unit)}
                            </span>
                          )}
                          <button
                            onClick={() => add(it.key, it.unit === 'kg' ? 0.25 : 1)}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-ink-line text-cream-dim hover:text-cream"
                          >
                            <IconPlus size={14} />
                          </button>
                        </div>
                        <span className="text-sm font-semibold text-cream">
                          {money(Math.round(it.price * it.qty))}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Totals + checkout */}
            <div className="shrink-0 border-t border-ink-line p-5">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-cream-dim">
                  <span>Subtotal</span>
                  <span className="text-cream">{money(subtotal)}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-cream-dim">
                    <span>GST ({Math.round(gstRate * 100)}%)</span>
                    <span className="text-cream">{money(tax)}</span>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between border-t border-ink-line pt-2">
                  <span className="font-serif text-lg text-cream">Total</span>
                  <span className="font-serif text-2xl font-semibold text-gold">
                    {money(total)}
                  </span>
                </div>
              </div>

              {error && (
                <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {error}
                </p>
              )}

              {isContinuing ? (
                <button onClick={addToOrder} className="btn-gold mt-4 w-full py-3">
                  <IconPlus size={18} /> Add to Order · {money(total)}
                </button>
              ) : (
                <>
                  <button
                    onClick={openPayment}
                    disabled={selectedTableBusy}
                    title={selectedTableBusy ? `${tableLabel(Number(table))} is already in use` : undefined}
                    className="btn-gold mt-4 w-full py-3 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IconCash size={18} /> Pay Now · {money(total)}
                  </button>
                  <button
                    onClick={placeUnpaid}
                    disabled={selectedTableBusy}
                    title={selectedTableBusy ? `${tableLabel(Number(table))} is already in use` : undefined}
                    className="btn-ghost mt-2 flex w-full items-center justify-center gap-2 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IconReceipt size={16} /> Place as Unpaid
                    <kbd className="rounded border border-ink-line bg-ink-soft px-1.5 py-0.5 text-[10px] font-semibold text-cream-dim">
                      F12
                    </kbd>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-only quick access to the order/checkout. The menu stays the main
          view; this jumps to the Current Order panel without scrolling. */}
      {items.length > 0 && (
        <button
          onClick={() =>
            document.getElementById('pos-order')?.scrollIntoView({ behavior: 'smooth' })
          }
          className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-ink-card/95 px-5 py-3 shadow-lift backdrop-blur lg:hidden"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-cream">
            <IconReceipt size={18} className="text-gold" />
            {items.reduce((s, it) => s + it.qty, 0)} in order
          </span>
          <span className="font-serif text-lg font-semibold text-gold">{money(total)}</span>
          <span className="text-xs font-semibold text-gold">View ↓</span>
        </button>
      )}

      {variantPick && (
        <VariantModal
          item={variantPick}
          onPick={(v) => chooseVariant(variantPick, v)}
          onClose={() => setVariantPick(null)}
        />
      )}

      {weightPick && (
        <WeightModal
          item={weightPick}
          initial={cart[weightPick.id]}
          onAdd={(kg) => chooseWeight(weightPick, kg)}
          onClose={() => setWeightPick(null)}
        />
      )}

      {showPayment && (
        <PaymentModal
          total={total}
          onlineAccounts={onlineAccounts}
          onClose={() => setShowPayment(false)}
          onConfirm={confirmPayment}
        />
      )}

      {activeReceipt && (
        <Receipt
          order={activeReceipt}
          orderTotal={orderTotal}
          onClose={() => setActiveReceipt(null)}
          onMarkPaid={() => {}}
          canMarkPaid={false}
        />
      )}

      {toast && <Toast order={toast} onClose={() => setToast(null)} />}

      {/* Department-wise kitchen slips — hidden on screen, printed via
          safePrint('print-kot') when an order is sent to the kitchen. */}
      <KitchenSlips order={kotOrder} />

      {showManageMostOrdered && (
        <ManageMostOrderedModal onClose={() => setShowManageMostOrdered(false)} />
      )}

      {showDeliveryModal && (
        <DeliveryDetailsModal
          initial={deliveryDetails}
          onConfirm={(details) => {
            setDeliveryDetails(details)
            setShowDeliveryModal(false)
          }}
          onClose={() => {
            // Delivery can't proceed without these details — nothing valid is
            // left selected, so back out of the table pick entirely.
            setTable('')
            setDeliveryDetails(null)
            setShowDeliveryModal(false)
          }}
        />
      )}
    </div>
  )
}
