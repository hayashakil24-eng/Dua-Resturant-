import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, PaymentBadge, EmptyState } from '../components/ui.jsx'
import { money, time } from '../utils/format.js'
import { IconOrders, IconSearch, IconCheck } from '../components/Icons.jsx'

const FILTERS = ['All', 'Paid', 'Unpaid']

export default function Orders() {
  const { orders, orderTotal, markPaid } = useApp()
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')

  const rows = useMemo(
    () =>
      orders.filter((o) => {
        const matchFilter = filter === 'All' || o.payment === filter
        const q = query.toLowerCase()
        const matchQuery =
          !q ||
          o.id.toLowerCase().includes(q) ||
          o.waiter.toLowerCase().includes(q) ||
          String(o.table).includes(q)
        return matchFilter && matchQuery
      }),
    [orders, filter, query],
  )

  return (
    <div>
      <PageHeader title="Orders" subtitle="Every order placed today, at a glance.">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream-dim">
            <IconSearch size={16} />
          </span>
          <input
            className="input py-2 pl-9 sm:w-64"
            placeholder="Search order / waiter / table"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </PageHeader>

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => {
          const count =
            f === 'All' ? orders.length : orders.filter((o) => o.payment === f).length
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                filter === f
                  ? 'border-gold/60 bg-gold/12 text-gold'
                  : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
              }`}
            >
              {f} <span className="text-xs opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={IconOrders} title="No orders found" hint="Try a different filter or search term." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-line text-xs uppercase tracking-wider text-cream-dim">
                    <th className="px-5 py-4 font-semibold">Order ID</th>
                    <th className="px-5 py-4 font-semibold">Table</th>
                    <th className="px-5 py-4 font-semibold">Waiter</th>
                    <th className="px-5 py-4 font-semibold">Items</th>
                    <th className="px-5 py-4 text-right font-semibold">Total</th>
                    <th className="px-5 py-4 font-semibold">Payment</th>
                    <th className="px-5 py-4 font-semibold">Time</th>
                    <th className="px-5 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-line">
                  {rows.map((o) => (
                    <tr key={o.id} className="transition hover:bg-white/[0.02]">
                      <td className="px-5 py-4 font-semibold text-gold">{o.id}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-lg bg-white/5 px-2 py-1 text-xs font-medium text-cream ring-1 ring-ink-line">
                          T{o.table}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-cream">{o.waiter}</td>
                      <td className="max-w-[240px] px-5 py-4 text-cream-dim">
                        <span className="line-clamp-1">
                          {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-cream">
                        {money(orderTotal(o.items).total)}
                      </td>
                      <td className="px-5 py-4">
                        <PaymentBadge status={o.payment} />
                      </td>
                      <td className="px-5 py-4 text-cream-dim">{time(o.createdAt)}</td>
                      <td className="px-5 py-4 text-right">
                        {o.payment === 'Unpaid' && (
                          <button
                            onClick={() => markPaid(o.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                          >
                            <IconCheck size={14} /> Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((o) => (
              <div key={o.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gold">{o.id}</span>
                  <PaymentBadge status={o.payment} />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-cream-dim">
                  <span className="rounded bg-white/5 px-2 py-0.5 ring-1 ring-ink-line">
                    Table {o.table}
                  </span>
                  <span>{o.waiter}</span>
                  <span>· {time(o.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-cream-dim">
                  {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-ink-line pt-3">
                  <span className="font-serif text-lg font-semibold text-cream">
                    {money(orderTotal(o.items).total)}
                  </span>
                  {o.payment === 'Unpaid' && (
                    <button
                      onClick={() => markPaid(o.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300"
                    >
                      <IconCheck size={14} /> Mark Paid
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
