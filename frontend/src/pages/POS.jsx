import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/ui.jsx'
import { money, time } from '../utils/format.js'
import { Receipt } from './Billing.jsx'
import PaymentModal from '../components/PaymentModal.jsx'
import ManageMostOrderedModal from '../components/ManageMostOrderedModal.jsx'
import KitchenSlips from '../components/KitchenSlips.jsx'
import { safePrint } from '../utils/print.js'
import { getRecipeStock, getStockShortfall } from '../utils/inventoryFlow.js'
import { canModify } from '../config/permissions.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { TABLE_CATEGORIES, tableLabel } from '../data/mockData.js'
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
            {tableLabel(order.table)} · {order.waiter} · {order.payment}
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

// "Best sellers" — a manually-curated, shared list (see AppContext). Tap to
// quick-add to the current order.
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
    <div className="w-32 shrink-0 overflow-hidden rounded-xl border border-gold/30 bg-ink-card">
      <MenuImage item={item} />
      <div className="p-2">
        <p className="truncate text-xs font-semibold text-cream">{item.name}</p>
        <p className="font-serif text-xs text-gold">
          {hasVariants && 'from '}
          {money(item.price)}
        </p>
        <button
          onClick={click}
          className={`mt-2 w-full rounded-lg py-1 text-xs font-bold transition ${
            added
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-gold-grad text-ink hover:brightness-110'
          }`}
        >
          {added ? '✓ Added' : '+ Add'}
        </button>
      </div>
    </div>
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
        <div className="card p-6">
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
  } = useApp()

  // Recipe-based stock status per menu item (only items with an approved recipe
  // are constrained; everything else is unconstrained). Recomputed as inventory
  // is auto-deducted by orders.
  const stockByItem = useMemo(() => {
    const map = {}
    menu.forEach((m) => {
      map[m.id] = getRecipeStock(m.id, inventory, recipes)
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
  const [variantPick, setVariantPick] = useState(null) // menu item awaiting a variant
  const [showManageMostOrdered, setShowManageMostOrdered] = useState(false)
  const mostOrderedItems = getMostOrderedItems()
  const canManageMostOrdered = user ? canModify(user.role, 'mostOrderedManage') : false

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
      emoji: base.emoji,
      qty,
    }
  }

  const items = Object.entries(cart)
    .map(([key, qty]) => resolveLine(key, qty))
    .filter((i) => i && i.qty > 0)

  const { subtotal, tax, total } = orderTotal(items)

  // Tables currently occupied by an active (unpaid) order — shown as "In Use".
  const occupiedTables = useMemo(
    () =>
      new Set(orders.filter((o) => o.payment === 'Unpaid' && !o.cancelled).map((o) => o.table)),
    [orders],
  )

  // Once a table is chosen AND items are on the order, lock the table until
  // checkout. Locking only after a table is picked avoids stranding an
  // items-first order (the selector stays usable until a table is set).
  const tableLocked = isContinuing || (items.length > 0 && Boolean(table))
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

  const add = (key) => setCart((c) => ({ ...c, [key]: (c[key] || 0) + 1 }))
  const dec = (key) =>
    setCart((c) => {
      const q = (c[key] || 0) - 1
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

  // Tapping a menu item: variant items open the picker, others add directly.
  const onItemClick = (m) => {
    if (m.variants && m.variants.length) setVariantPick(m)
    else add(m.id)
  }
  const chooseVariant = (m, v) => {
    add(`${m.id}::${v.label}`)
    setVariantPick(null)
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
    if (!waiter) return 'Please assign a waiter.'
    // Prevent out-of-stock orders: the cart's recipes must not exceed stock.
    const short = getStockShortfall(
      items.map(({ key, qty }) => ({ id: key, qty })),
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
  }

  const placeOrder = async ({ payment, method, onlineAccount = null }) => {
    const order = await addOrder({
      table: Number(table),
      waiter,
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
    })
    if (order?.error) return order
    resetForm()
    return order
  }

  // Print department-wise kitchen slips (one per counter) for an order that was
  // just sent to the kitchen. Renders the slips, then prints on the next tick.
  const printKitchenSlips = (order) => {
    if (!order?.items?.length) return
    setKotOrder(order)
    setTimeout(() => safePrint('print-kot'), 80)
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
      // creating a new order) and never while a modal owns the screen.
      if (isContinuing || showPayment || variantPick || activeReceipt) return
      e.preventDefault()
      placeUnpaidRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isContinuing, showPayment, variantPick, activeReceipt])

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
      />

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
                {it.name} <span className="text-cream">×{it.qty}</span>
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
                      {count}
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
            <div className="flex items-center justify-between border-b border-ink-line p-5">
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
            <div className="border-b border-ink-line p-5">
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
                    onChange={(e) => setTable(e.target.value)}
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
                    {TABLE_CATEGORIES.map((c) => (
                      <optgroup key={c} label={c === 'HUT' ? '📍 HUT (Outdoor)' : `📍 Category ${c}`}>
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
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                    Waiter
                  </label>
                  <select
                    className="input py-2"
                    value={waiter}
                    onChange={(e) => setWaiter(e.target.value)}
                  >
                    <option value="">Assign</option>
                    {waiters.map((w) => (
                      <option key={w.id} value={w.name}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {tableLocked && (
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
                pushed the checkout buttons below the viewport). */}
            <div className="flex-1 overflow-y-auto p-5">
              {items.length === 0 ? (
                <div className="grid h-40 place-items-center text-center">
                  <div>
                    <p className="text-sm text-cream-dim">Cart is empty</p>
                    <p className="mt-1 text-xs text-cream-dim">
                      Tap menu items to add them.
                    </p>
                  </div>
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

                      {/* Qty stepper + line total */}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => dec(it.key)}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-ink-line text-cream-dim hover:text-cream"
                          >
                            <IconMinus size={14} />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold text-cream">
                            {it.qty}
                          </span>
                          <button
                            onClick={() => add(it.key)}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-ink-line text-cream-dim hover:text-cream"
                          >
                            <IconPlus size={14} />
                          </button>
                        </div>
                        <span className="text-sm font-semibold text-cream">
                          {money(it.price * it.qty)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Totals + checkout */}
            <div className="border-t border-ink-line p-5">
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
                  <button onClick={openPayment} className="btn-gold mt-4 w-full py-3">
                    <IconCash size={18} /> Pay Now · {money(total)}
                  </button>
                  <button
                    onClick={placeUnpaid}
                    className="btn-ghost mt-2 flex w-full items-center justify-center gap-2 py-2.5 text-sm"
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
    </div>
  )
}
