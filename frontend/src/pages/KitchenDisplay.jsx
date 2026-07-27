import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { tableLabel } from '../data/mockData.js'
import { IconClose, IconCheck, IconClock, IconSearch } from '../components/Icons.jsx'

const elapsedMin = (iso, now) =>
  Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))

// Lines shown before the card collapses the rest behind "+N more". Keeps every
// card the same height on the wall display — a 12-item order used to stretch
// its whole grid row, pushing the short tickets beside it out of shape.
const COLLAPSED_LINES = 4

function OrderCard({ order, items, now, onReady, onItemReady, onClear, deptFor, showDeptTag }) {
  const ready = order.kitchen === 'Ready'
  const mins = elapsedMin(order.createdAt, now)
  const urgent = !ready && mins >= 15
  const lines = items || order.items
  const readyCount = lines.filter((it) => it.ready).length

  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? lines : lines.slice(0, COLLAPSED_LINES)
  const hidden = lines.length - shown.length

  const border = ready
    ? 'border-emerald-500/70 bg-emerald-500/10'
    : urgent
      ? 'border-rose-500/70 bg-rose-500/10'
      : 'border-gold/40 bg-ink-card'

  return (
    // Fixed height so every ticket is identical; an expanded list scrolls
    // inside the card rather than growing it.
    <div className={`flex h-[21rem] flex-col rounded-2xl border-2 p-4 ${border}`}>
      <div className="flex shrink-0 items-start justify-between">
        <div className="min-w-0">
          <p className="truncate font-serif text-2xl font-bold leading-none text-cream">
            {tableLabel(order.table)}
          </p>
          <p className="mt-1 truncate text-base text-cream-dim">{order.waiter || '—'}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
              ready ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gold/15 text-gold'
            }`}
          >
            {order.id}
          </span>
          <span className={`text-xs font-bold ${readyCount === lines.length ? 'text-emerald-300' : 'text-cream-dim'}`}>
            {readyCount} / {lines.length} ready
          </span>
        </div>
      </div>

      <div className="my-3 shrink-0 border-t border-ink-line" />

      {/* Tap a line to mark it ready (toggle) — the order goes Ready when all lines are done. */}
      <ul className="flex-1 space-y-2 overflow-y-auto pe-1">
        {shown.map((it) => {
          const dept = showDeptTag && deptFor ? deptFor(it.id) : null
          return (
            <li key={it.id}>
              <button
                onClick={() => onItemReady(order.id, it.itemId)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${
                  it.ready
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-ink-line bg-white/[0.02] hover:border-gold/40'
                }`}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${
                      it.ready ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300' : 'border-ink-line text-transparent'
                    }`}
                  >
                    <IconCheck size={15} />
                  </span>
                  {/* Name truncates first — the department tag must never wrap
                      mid-word (a long name + a long tag like "Beverages
                      Counter" used to split the tag's pill across two lines). */}
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      title={it.name}
                      className={`truncate text-base leading-tight ${it.ready ? 'text-cream-dim line-through' : 'text-cream'}`}
                    >
                      {it.name}
                    </span>
                    {dept && (
                      <span className="shrink-0 whitespace-nowrap rounded bg-white/5 px-1.5 py-0.5 text-[11px] font-medium text-cream-dim ring-1 ring-ink-line">
                        {dept.name}
                      </span>
                    )}
                  </span>
                </span>
                <span className={`shrink-0 text-base font-bold ${it.ready ? 'text-emerald-300/70' : 'text-gold'}`}>×{it.qty}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {(hidden > 0 || expanded) && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 shrink-0 rounded-lg border border-ink-line bg-white/[0.03] py-1.5 text-sm font-semibold text-cream-dim transition hover:text-cream"
        >
          {hidden > 0 ? `+${hidden} more` : 'Show less'}
        </button>
      )}

      <div className="mt-3 flex shrink-0 items-center justify-between border-t border-ink-line pt-3">
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 text-base font-bold ${
            urgent ? 'text-rose-300' : 'text-cream'
          }`}
        >
          <IconClock size={18} /> {mins} min
        </span>
        {ready ? (
          <button
            onClick={() => onClear(order.id)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 px-3 py-2 text-base font-bold text-emerald-300 ring-1 ring-emerald-500/40 transition hover:bg-emerald-500/30"
          >
            <IconCheck size={18} /> Served
          </button>
        ) : (
          <button
            onClick={() => onReady(order.id)}
            className="rounded-xl bg-gold-grad px-3.5 py-2 text-base font-bold text-ink transition hover:brightness-110"
          >
            Mark all ready
          </button>
        )}
      </div>
    </div>
  )
}

export default function KitchenDisplay() {
  const { orders, markReady, markItemReady, clearKitchen, departments, getDepartmentForItem } = useApp()
  const [now, setNow] = useState(() => Date.now())
  const [dept, setDept] = useState('all') // 'all' | department id
  const [status, setStatus] = useState('all') // 'all' | 'pending' | 'ready'
  const [query, setQuery] = useState('')

  // Auto-refresh every 2 seconds (keeps elapsed timers + clock current).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000)
    return () => clearInterval(id)
  }, [])

  // Newest ticket first: a freshly punched order lands at the top-left of the
  // wall where the kitchen is already looking, instead of at the end of a long
  // queue. The per-ticket elapsed timer (red past 15 min) is what flags an old
  // order now, not its position.
  const active = useMemo(
    () =>
      orders
        .filter((o) => (o.kitchen === 'Pending' || o.kitchen === 'Ready') && !o.cancelled)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [orders],
  )
  const cooking = active.filter((o) => o.kitchen === 'Pending').length
  const readyCount = active.length - cooking

  // When a counter is selected, show only its items (and drop orders that have
  // none). "All" shows every order with a small counter tag per line.
  const byCounter = useMemo(() => {
    if (dept === 'all') return active.map((o) => ({ order: o, items: o.items }))
    return active
      .map((o) => ({ order: o, items: o.items.filter((it) => getDepartmentForItem(it.id)?.id === dept) }))
      .filter((v) => v.items.length > 0)
  }, [active, dept, getDepartmentForItem])

  // Ready/not-ready + free-text search. Search covers everything printed on a
  // ticket — table, order number, waiter and the dish names — so the kitchen
  // can find "the karahi" or "A 11" without scanning the whole wall.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return byCounter.filter(({ order, items }) => {
      if (status === 'ready' && order.kitchen !== 'Ready') return false
      if (status === 'pending' && order.kitchen !== 'Pending') return false
      if (!q) return true
      return (
        order.id.toLowerCase().includes(q) ||
        tableLabel(order.table).toLowerCase().includes(q) ||
        (order.waiter || '').toLowerCase().includes(q) ||
        items.some((it) => it.name.toLowerCase().includes(q))
      )
    })
  }, [byCounter, status, query])

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

      {/* Filters — counter routing, ready state, and free-text search */}
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-line bg-ink/70 px-6 py-3">
        {counters.length > 0 && (
          <div className="scrollbar-hide flex gap-2 overflow-x-auto">
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

        <div className="ms-auto flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-full border border-ink-line">
            {[
              ['all', 'All', active.length],
              ['pending', 'Not ready', cooking],
              ['ready', 'Ready', readyCount],
            ].map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setStatus(key)}
                className={`px-4 py-1.5 text-sm font-semibold transition ${
                  status === key ? 'bg-gold/15 text-gold' : 'text-cream-dim hover:text-cream'
                }`}
              >
                {label} <span className="text-xs">({count})</span>
              </button>
            ))}
          </div>

          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-cream-dim">
              <IconSearch size={16} />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search table, order, dish…"
              className="w-56 rounded-full border border-ink-line bg-ink-soft py-1.5 ps-9 pe-8 text-sm text-cream outline-none transition placeholder:text-cream-dim focus:border-gold/50"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute inset-y-0 end-2 grid place-items-center text-cream-dim transition hover:text-cream"
              >
                <IconClose size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="p-6">
        {visible.length === 0 ? (
          <div className="grid h-[70vh] place-items-center text-center">
            <div>
              <p className="font-serif text-3xl text-cream">
                {query || status !== 'all' ? 'Nothing matches' : 'All caught up 🎉'}
              </p>
              <p className="mt-2 text-cream-dim">
                {query || status !== 'all'
                  ? 'Try a different search or filter.'
                  : dept === 'all'
                    ? 'No active kitchen orders right now.'
                    : 'No pending items for this counter.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {visible.map(({ order, items }) => (
              <OrderCard
                key={order.id}
                order={order}
                items={items}
                now={now}
                onReady={markReady}
                onItemReady={markItemReady}
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
