import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/ui.jsx'
import { money } from '../utils/format.js'
import {
  MENU,
  MENU_CATEGORIES,
  WAITERS,
  TABLES,
  TAX_RATE,
} from '../data/mockData.js'
import {
  IconPlus,
  IconMinus,
  IconTrash,
  IconSearch,
  IconCash,
  IconCheck,
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

export default function POS() {
  const { addOrder, orderTotal, user } = useApp()
  const [cat, setCat] = useState('All')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState({}) // { menuId: qty }
  const [table, setTable] = useState('')
  const [waiter, setWaiter] = useState('')
  const [payment, setPayment] = useState('Unpaid')
  const [method, setMethod] = useState('Cash')
  const [toast, setToast] = useState(null)
  const [error, setError] = useState('')

  const filtered = useMemo(
    () =>
      MENU.filter(
        (m) =>
          (cat === 'All' || m.category === cat) &&
          m.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [cat, query],
  )

  const items = Object.entries(cart)
    .map(([id, qty]) => {
      const m = MENU.find((x) => x.id === id)
      return { ...m, qty }
    })
    .filter((i) => i.qty > 0)

  const { subtotal, tax, total } = orderTotal(items)

  const add = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }))
  const dec = (id) =>
    setCart((c) => {
      const q = (c[id] || 0) - 1
      const next = { ...c }
      if (q <= 0) delete next[id]
      else next[id] = q
      return next
    })
  const removeItem = (id) =>
    setCart((c) => {
      const next = { ...c }
      delete next[id]
      return next
    })
  const clear = () => setCart({})

  const checkout = () => {
    if (items.length === 0) return setError('Add at least one item to the order.')
    if (!table) return setError('Please select a table number.')
    if (!waiter) return setError('Please assign a waiter.')
    setError('')
    const order = addOrder({
      table: Number(table),
      waiter,
      items: items.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
      payment: user?.role === 'Manager' ? 'Unpaid' : payment,
      method: user?.role === 'Manager' ? '—' : method,
    })
    setToast(order)
    clear()
    setTable('')
    setWaiter('')
    setPayment('Unpaid')
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div>
      <PageHeader title="New Order" subtitle="Build the order, assign a table & waiter, then checkout." />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Menu side */}
        <div>
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
            {MENU_CATEGORIES.map((c) => (
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
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => add(m.id)}
                className="card group relative flex flex-col p-3 text-left transition hover:border-gold/40 hover:shadow-gold"
              >
                {/* Food Image Container */}
                <div className="relative h-28 w-full overflow-hidden rounded-xl bg-ink-line">
                  <img
                    src={m.image}
                    alt={m.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute left-2 top-2 rounded-lg bg-ink/75 px-2 py-0.5 text-xs backdrop-blur-sm">
                    {m.emoji}
                  </span>
                </div>

                <span className="mt-3 line-clamp-2 text-sm font-semibold text-cream">
                  {m.name}
                </span>
                <span className="mt-1 text-xs text-cream-dim">{m.category}</span>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-serif text-base text-gold">{money(m.price)}</span>
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold/10 text-gold ring-1 ring-gold/20 transition group-hover:bg-gold-grad group-hover:text-ink">
                    <IconPlus size={16} />
                  </span>
                </div>
                {cart[m.id] > 0 && (
                  <span className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-gold-grad px-1.5 text-xs font-bold text-ink shadow-md">
                    {cart[m.id]}
                  </span>
                )}
              </button>
            ))}
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
            <div className="grid grid-cols-2 gap-3 border-b border-ink-line p-5">
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  Table
                </label>
                <select
                  className="input py-2"
                  value={table}
                  onChange={(e) => setTable(e.target.value)}
                >
                  <option value="">Select</option>
                  {TABLES.map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.id} · {t.seats} seats
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
                  {WAITERS.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
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
                    <li key={it.id} className="flex items-center gap-3">
                      <span className="text-xl">{it.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-cream">{it.name}</p>
                        <p className="text-xs text-cream-dim">{money(it.price)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => dec(it.id)}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-ink-line text-cream-dim hover:text-cream"
                        >
                          <IconMinus size={14} />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold text-cream">
                          {it.qty}
                        </span>
                        <button
                          onClick={() => add(it.id)}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-ink-line text-cream-dim hover:text-cream"
                        >
                          <IconPlus size={14} />
                        </button>
                      </div>
                      <span className="w-16 text-right text-sm font-semibold text-cream">
                        {money(it.price * it.qty)}
                      </span>
                      <button
                        onClick={() => removeItem(it.id)}
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

              {/* Payment status */}
              {user?.role !== 'Manager' && (
                <div className="mt-4">
                  <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                    Payment status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Paid', 'Unpaid'].map((p) => (
                      <button
                        key={p}
                        onClick={() => setPayment(p)}
                        className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                          payment === p
                            ? p === 'Paid'
                              ? 'border-emerald-500/50 bg-emerald-500/12 text-emerald-300'
                              : 'border-amber-500/50 bg-amber-500/12 text-amber-300'
                            : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  {payment === 'Paid' && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {['Cash', 'Card', 'Online'].map((mth) => (
                        <button
                          key={mth}
                          onClick={() => setMethod(mth)}
                          className={`rounded-lg border py-2 text-xs font-medium transition ${
                            method === mth
                              ? 'border-gold/50 bg-gold/12 text-gold'
                              : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                          }`}
                        >
                          {mth}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {error}
                </p>
              )}

              <button onClick={checkout} className="btn-gold mt-4 w-full py-3">
                <IconCash size={18} /> Place Order · {money(total)}
              </button>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast order={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
