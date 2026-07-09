import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { IconClose, IconCheck, IconClock } from '../components/Icons.jsx'

const elapsedMin = (iso, now) =>
  Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))

function OrderCard({ order, now, onReady, onClear }) {
  const ready = order.kitchen === 'Ready'
  const mins = elapsedMin(order.createdAt, now)
  const urgent = !ready && mins >= 15

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
            Table {order.table}
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
        {order.items.map((it) => (
          <li key={it.id} className="flex items-baseline justify-between gap-3 text-cream">
            <span className="text-lg leading-tight">{it.name}</span>
            <span className="shrink-0 text-lg font-bold text-gold">×{it.qty}</span>
          </li>
        ))}
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
  const { orders, markReady, clearKitchen } = useApp()
  const [now, setNow] = useState(() => Date.now())

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

  const clock = new Date(now).toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  return (
    <div className="min-h-screen bg-ink bg-ink-grad">
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

      <main className="p-6">
        {active.length === 0 ? (
          <div className="grid h-[70vh] place-items-center text-center">
            <div>
              <p className="font-serif text-3xl text-cream">All caught up 🎉</p>
              <p className="mt-2 text-cream-dim">No active kitchen orders right now.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {active.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                now={now}
                onReady={markReady}
                onClear={clearKitchen}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
