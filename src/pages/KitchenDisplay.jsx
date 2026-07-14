import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { tableLabel } from '../data/mockData.js'
import { IconClose, IconCheck, IconClock } from '../components/Icons.jsx'

const elapsedMin = (iso, now) =>
  Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))

function OrderCard({ order, items, now, onReady, onClear, deptFor, showDeptTag }) {
  const ready = order.kitchen === 'Ready'
  const mins = elapsedMin(order.createdAt, now)
  const urgent = !ready && mins >= 15
  const lines = items || order.items

  const border = ready
    ? 'border-emerald-500/70 bg-emerald-500/10'
    : urgent
      ? 'border-rose-500/70 bg-rose-500/10'
      : 'border-gold/40 bg-ink-card'

  return (
    <div className={`flex flex-col rounded-2xl border-2 p-5 ${border}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-serif text-3xl font-bold leading-none text-cream">
            {tableLabel(order.table)}
          </p>
          <p className="mt-1 text-lg text-cream-dim">{order.waiter}</p>
        </div>
        <span
          className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
            ready ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gold/15 text-gold'
          }`}
        >
          {order.id}
        </span>
      </div>

      <div className="my-4 border-t border-ink-line" />

      <ul className="flex-1 space-y-2.5">
        {lines.map((it) => {
          const dept = showDeptTag && deptFor ? deptFor(it.id) : null
          return (
            <li key={it.id} className="flex items-baseline justify-between gap-3 text-cream">
              <span className="min-w-0 text-lg leading-tight">
                {it.name}
                {dept && (
                  <span className="ms-2 rounded bg-white/5 px-1.5 py-0.5 align-middle text-[11px] font-medium text-cream-dim ring-1 ring-ink-line">
                    {dept.name}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-lg font-bold text-gold">×{it.qty}</span>
            </li>
          )
        })}
      </ul>

      <div className="mt-4 flex items-center justify-between border-t border-ink-line pt-4">
        <span
          className={`inline-flex items-center gap-1.5 text-xl font-bold ${
            urgent ? 'text-rose-300' : 'text-cream'
          }`}
        >
          <IconClock size={20} /> {mins} min
        </span>
        {ready ? (
          <button
            onClick={() => onClear(order.id)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-2.5 text-lg font-bold text-emerald-300 ring-1 ring-emerald-500/40 transition hover:bg-emerald-500/30"
          >
            <IconCheck size={20} /> Served
          </button>
        ) : (
          <button
            onClick={() => onReady(order.id)}
            className="rounded-xl bg-gold-grad px-5 py-2.5 text-lg font-bold text-ink transition hover:brightness-110"
          >
            Mark Ready
          </button>
        )}
      </div>
    </div>
  )
}

export default function KitchenDisplay() {
  const { orders, markReady, clearKitchen, departments, getDepartmentForItem } = useApp()
  const [now, setNow] = useState(() => Date.now())
  const [dept, setDept] = useState('all') // 'all' | department id

  // Auto-refresh every 2 seconds (keeps elapsed timers + clock current).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000)
    return () => clearInterval(id)
  }, [])

  const active = useMemo(
    () =>
      orders
        .filter((o) => (o.kitchen === 'Pending' || o.kitchen === 'Ready') && !o.cancelled)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [orders],
  )
  const cooking = active.filter((o) => o.kitchen === 'Pending').length

  // When a counter is selected, show only its items (and drop orders that have
  // none). "All" shows every order with a small counter tag per line.
  const visible = useMemo(() => {
    if (dept === 'all') return active.map((o) => ({ order: o, items: o.items }))
    return active
      .map((o) => ({ order: o, items: o.items.filter((it) => getDepartmentForItem(it.id)?.id === dept) }))
      .filter((v) => v.items.length > 0)
  }, [active, dept, getDepartmentForItem])

  const counters = departments.filter((d) => d.status !== 'inactive')

  const clock = new Date(now).toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  return (
    // Kitchen Display stays English + LTR (operational screen).
    <div dir="ltr" className="min-h-screen bg-ink bg-ink-grad">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-ink-line bg-ink/90 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-3xl font-bold text-cream sm:text-4xl">
            Kitchen Display
          </h1>
          <span className="rounded-full bg-gold/15 px-3 py-1 text-sm font-bold text-gold ring-1 ring-gold/25">
            {cooking} cooking
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden items-center gap-2 text-sm text-cream-dim sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Auto-refresh · {clock}
          </span>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-ink-line bg-ink-soft px-4 py-2 text-sm font-semibold text-cream-dim transition hover:text-cream"
          >
            <IconClose size={18} /> Exit
          </Link>
        </div>
      </header>

      {/* Counter filter — routes orders to the right kitchen/counter */}
      {counters.length > 0 && (
        <div className="scrollbar-hide flex gap-2 overflow-x-auto border-b border-ink-line bg-ink/70 px-6 py-3">
          <button
            onClick={() => setDept('all')}
            className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              dept === 'all' ? 'border-gold/60 bg-gold/15 text-gold' : 'border-ink-line text-cream-dim hover:text-cream'
            }`}
          >
            All Counters
          </button>
          {counters.map((c) => (
            <button
              key={c.id}
              onClick={() => setDept(c.id)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                dept === c.id ? 'border-gold/60 bg-gold/15 text-gold' : 'border-ink-line text-cream-dim hover:text-cream'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <main className="p-6">
        {visible.length === 0 ? (
          <div className="grid h-[70vh] place-items-center text-center">
            <div>
              <p className="font-serif text-3xl text-cream">All caught up 🎉</p>
              <p className="mt-2 text-cream-dim">
                {dept === 'all' ? 'No active kitchen orders right now.' : 'No pending items for this counter.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map(({ order, items }) => (
              <OrderCard
                key={order.id}
                order={order}
                items={items}
                now={now}
                onReady={markReady}
                onClear={clearKitchen}
                deptFor={getDepartmentForItem}
                showDeptTag={dept === 'all'}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
