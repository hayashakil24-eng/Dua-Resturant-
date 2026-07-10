import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/ui.jsx'
import { money, time } from '../utils/format.js'
import { Receipt } from './Billing.jsx'
import { TAX_RATE } from '../data/mockData.js'
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
            Table {order.table} · {order.waiter} · {order.payment}
          </p>
        </div>
        <button onClick={onClose} className="ml-3 text-xs text-gold hover:underline">
          Dismiss
        </button>
      </div>
    </div>
  )
}

// Round up to the next multiple of `step` (for quick-cash suggestions).
const roundUp = (n, step) => Math.ceil(n / step) * step

function PaymentModal({ total, onClose, onConfirm }) {
  const [method, setMethod] = useState('Cash')
  const [tendered, setTendered] = useState('')

  const isCash = method === 'Cash'
  const tenderedNum = Number(tendered) || 0
  const change = tenderedNum - total
  const canConfirm = !isCash || tenderedNum >= total

  // Handy cash denominations at or above the bill total.
  const suggestions = [
    ...new Set([total, roundUp(total, 100), roundUp(total, 500), roundUp(total, 1000)]),
  ]
    .filter((v) => v >= total)
    .slice(0, 4)

  const confirm = () => {
    if (!canConfirm) return
    onConfirm(method, isCash ? tenderedNum : total)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">Take Payment</h3>
              <p className="mt-0.5 text-xs text-cream-dim">Select method and collect the amount due.</p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          {/* Amount due */}
          <div className="mt-5 rounded-2xl border border-gold/25 bg-gold/[0.06] p-5 text-center">
            <p className="text-[11px] uppercase tracking-widest text-gold/80">Amount due</p>
            <p className="mt-1 font-serif text-4xl font-semibold text-gold">{money(total)}</p>
          </div>

          {/* Method */}
          <div className="mt-5">
            <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
              Payment method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['Cash', 'Card', 'Online'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                    method === m
                      ? 'border-gold/50 bg-gold/12 text-gold'
                      : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Cash tendered + change */}
          {isCash && (
            <div className="mt-5">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                Cash received
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                autoFocus
                className="input"
                placeholder="Enter amount received…"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((v) => (
                  <button
                    key={v}
                    onClick={() => setTendered(String(v))}
                    className="rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 text-xs font-medium text-cream-dim transition hover:border-gold/40 hover:text-cream"
                  >
                    {money(v)}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-ink-line bg-ink-soft px-4 py-3">
                <span className="text-sm text-cream-dim">
                  {change >= 0 ? 'Change due' : 'Remaining'}
                </span>
                <span
                  className={`font-serif text-2xl font-semibold ${
                    change >= 0 ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {money(Math.abs(change))}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={!canConfirm}
              className="btn-gold flex-1 py-3 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconCheck size={18} /> Confirm {money(total)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MenuImage({ item }) {
  const [error, setError] = useState(false)

  if (item.image && !error) {
    return (
      <div className="relative h-28 w-full overflow-hidden rounded-xl bg-ink-line">
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
    <div className="relative h-28 w-full rounded-xl bg-ink-soft border border-ink-line shadow-inner" />
  )
}

// "Best sellers" — ranks items by qty ordered across all (non-cancelled)
// orders, joined to the current menu for image/price. Tap to quick-add.
function MostOrderedCard({ item, count, onAdd }) {
  const [added, setAdded] = useState(false)
  const hasVariants = item.variants && item.variants.length
  const click = () => {
    onAdd(item)
    setAdded(true)
    setTimeout(() => setAdded(false), 700)
  }
  return (
    <div className="w-32 shrink-0 overflow-hidden rounded-xl border border-gold/30 bg-ink-card">
      <div className="relative">
        <MenuImage item={item} />
        <span className="absolute right-1.5 top-1.5 rounded-full bg-gold-grad px-2 py-0.5 text-[10px] font-bold text-ink shadow-md">
          {count}×
        </span>
      </div>
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

function MostOrdered({ orders, menu, onAdd }) {
  const top = useMemo(() => {
    const counts = {}
    orders.forEach((o) => {
      if (o.cancelled) return
      o.items.forEach((it) => {
        const baseId = String(it.id).split('::')[0]
        counts[baseId] = (counts[baseId] || 0) + it.qty
      })
    })
    return Object.entries(counts)
      .map(([id, count]) => ({ item: menu.find((m) => m.id === id), count }))
      .filter((x) => x.item && x.item.active !== false)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [orders, menu])

  if (top.length === 0) return null

  return (
    <div className="mb-5">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="font-serif text-xl text-cream">⭐ Most Ordered</h2>
        <span className="text-xs text-cream-dim">Quick-add your best sellers</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {top.map(({ item, count }) => (
          <MostOrderedCard key={item.id} item={item} count={count} onAdd={onAdd} />
        ))}
      </div>
      <div className="mt-4 border-t border-ink-line" />
    </div>
  )
}

// Quick size/type chooser for items that have variants (Pizza, Steaks).
function VariantModal({ item, onPick, onClose }) {
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
  const { addOrder, orderTotal, orders, menu, menuCategories, tables, waiters } = useApp()
  const location = useLocation()
  const [cat, setCat] = useState('All')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState({}) // { lineKey: qty }, lineKey = id or `id::variant`
  const [variantPick, setVariantPick] = useState(null) // menu item awaiting a variant
  // Pre-selected from the Tables page ("start order on this table").
  const [table, setTable] = useState(() =>
    location.state?.presetTable ? String(location.state.presetTable) : '',
  )
  const [waiter, setWaiter] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [activeReceipt, setActiveReceipt] = useState(null)
  const [toast, setToast] = useState(null)
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
  const tableLocked = items.length > 0 && Boolean(table)
  const [lockedAt, setLockedAt] = useState(null)
  useEffect(() => {
    setLockedAt((prev) => (tableLocked ? prev || new Date() : null))
  }, [tableLocked])

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
    return null
  }

  const resetForm = () => {
    clear()
    setTable('')
    setWaiter('')
  }

  const placeOrder = ({ payment, method }) => {
    const order = addOrder({
      table: Number(table),
      waiter,
      items: items.map(({ key, name, price, qty }) => ({ id: key, name, price, qty })),
      payment,
      method,
    })
    resetForm()
    return order
  }

  // "Pay Now" — validate, then open the payment modal.
  const openPayment = () => {
    const err = validate()
    if (err) return setError(err)
    setError('')
    setShowPayment(true)
  }

  // Confirmed in the payment modal → mark paid, then auto-open receipt to print.
  const confirmPayment = (method) => {
    const order = placeOrder({ payment: 'Paid', method })
    setShowPayment(false)
    setActiveReceipt(order)
  }

  // "Place as Unpaid" — send to kitchen now, collect payment later at billing.
  const placeUnpaid = () => {
    const err = validate()
    if (err) return setError(err)
    setError('')
    const order = placeOrder({ payment: 'Unpaid', method: '—' })
    setToast(order)
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div>
      <PageHeader title="New Order" subtitle="Build the order, assign a table & waiter, then checkout." />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Menu side */}
        <div>
          <MostOrdered orders={orders} menu={menu} onAdd={onItemClick} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cream-dim">
                <IconSearch size={18} />
              </span>
              <input
                className="input pl-11"
                placeholder="Search menu…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {['All', ...menuCategories].map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  cat === c
                    ? 'border-gold/60 bg-gold/12 text-gold'
                    : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((m) => {
              const count = qtyFor(m)
              const hasVariants = m.variants && m.variants.length
              return (
                <button
                  key={m.id}
                  onClick={() => onItemClick(m)}
                  className="card group relative flex flex-col p-3 text-left transition hover:border-gold/40 hover:shadow-gold"
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
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold/10 text-gold ring-1 ring-gold/20 transition group-hover:bg-gold-grad group-hover:text-ink">
                      <IconPlus size={16} />
                    </span>
                  </div>
                  {count > 0 && (
                    <span className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-gold-grad px-1.5 text-xs font-bold text-ink shadow-md">
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
            {filtered.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-cream-dim">
                No items match your search.
              </p>
            )}
          </div>
        </div>

        {/* Cart side */}
        <div className="lg:sticky lg:top-20 lg:h-fit">
          <div className="card flex max-h-[calc(100vh-7rem)] flex-col">
            <div className="flex items-center justify-between border-b border-ink-line p-5">
              <h3 className="font-serif text-xl text-cream">Current Order</h3>
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
                    <option value="">Select</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        Table {t.id} · {t.seats} seats{occupiedTables.has(t.id) ? ' (In Use)' : ''}
                      </option>
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
                <p className="mt-3 flex items-center gap-2 rounded-lg border border-gold/25 bg-gold/[0.06] px-3 py-2 text-xs text-gold">
                  🔒 Locked to Table {table} until checkout
                  {lockedAt ? ` · since ${time(lockedAt.toISOString())}` : ''}. Remove all items or
                  checkout to change tables.
                </p>
              )}
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-5">
              {items.length === 0 ? (
                <div className="grid h-40 place-items-center text-center">
                  <div>
                    <p className="text-sm text-cream-dim">Cart is empty</p>
                    <p className="mt-1 text-xs text-cream-dim/60">
                      Tap menu items to add them.
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="space-y-3">
                  {items.map((it) => (
                    <li key={it.key} className="flex items-center gap-3">
                      {it.emoji && <span className="text-xl">{it.emoji}</span>}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-cream">{it.name}</p>
                        <p className="text-xs text-cream-dim">{money(it.price)}</p>
                      </div>
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
                      <span className="w-16 text-right text-sm font-semibold text-cream">
                        {money(it.price * it.qty)}
                      </span>
                      <button
                        onClick={() => removeItem(it.key)}
                        className="text-cream-dim hover:text-rose-300"
                      >
                        <IconTrash size={16} />
                      </button>
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
                <div className="flex justify-between text-cream-dim">
                  <span>GST ({Math.round(TAX_RATE * 100)}%)</span>
                  <span className="text-cream">{money(tax)}</span>
                </div>
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

              <button onClick={openPayment} className="btn-gold mt-4 w-full py-3">
                <IconCash size={18} /> Pay Now · {money(total)}
              </button>
              <button
                onClick={placeUnpaid}
                className="btn-ghost mt-2 w-full py-2.5 text-sm"
              >
                <IconReceipt size={16} /> Place as Unpaid
              </button>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  )
}
