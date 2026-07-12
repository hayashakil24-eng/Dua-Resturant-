import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, PaymentBadge, EmptyState } from '../components/ui.jsx'
import { money, time } from '../utils/format.js'
import { IconOrders, IconSearch, IconCheck, IconClose } from '../components/Icons.jsx'
import { canModify } from '../config/permissions.js'

const FILTERS = ['All', 'Paid', 'Unpaid', 'Cancelled']
const CANCEL_REASONS = ['Customer Request', 'Wrong Order', 'Out of Stock', 'Other']

function CancelledBadge() {
  return (
    <span className="badge bg-rose-500/12 text-rose-300 ring-1 ring-rose-500/30">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
      Cancelled
    </span>
  )
}

// Admin-only cancel dialog — reason required, no PIN (role-gated).
function CancelModal({ order, orderTotal, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const { total } = orderTotal(order.items, order.discount?.amount)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">Cancel Order</h3>
              <p className="mt-0.5 text-xs text-cream-dim">This action is recorded in the audit log.</p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          {/* Order summary */}
          <div className="mt-5 rounded-xl border border-ink-line bg-ink-soft p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gold">{order.id}</span>
              <span className="text-sm text-cream-dim">Table {order.table}</span>
            </div>
            <p className="mt-2 text-xs text-cream-dim">
              {order.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
            </p>
            <div className="mt-2 border-t border-ink-line pt-2 text-right">
              <span className="font-serif text-lg font-semibold text-cream">{money(total)}</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
              Reason for cancellation <span className="text-rose-300">*</span>
            </label>
            <select className="input py-2.5" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Select a reason…</option>
              {CANCEL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
              Notes (optional)
            </label>
            <textarea
              className="input min-h-[64px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Customer left before serving"
            />
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              Keep Order
            </button>
            <button
              onClick={() => onConfirm({ reason, notes: notes.trim() })}
              disabled={!reason}
              className="flex-1 rounded-xl border border-rose-500/50 bg-rose-500/15 py-3 font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Orders() {
  const { orders, orderTotal, markPaid, cancelOrder, auditLog, user } = useApp()
  const canMarkPaid = user && canModify(user.role, 'orders')
  const canCancel = user && canModify(user.role, 'orderCancel')
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)

  const rows = useMemo(
    () =>
      orders.filter((o) => {
        const matchFilter =
          filter === 'All'
            ? true
            : filter === 'Cancelled'
              ? o.cancelled
              : o.payment === filter && !o.cancelled
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

  const filterCount = (f) => {
    if (f === 'All') return orders.length
    if (f === 'Cancelled') return orders.filter((o) => o.cancelled).length
    return orders.filter((o) => o.payment === f && !o.cancelled).length
  }

  // Actions shared by desktop rows and mobile cards.
  const OrderActions = ({ o }) => {
    if (o.cancelled) return null
    const isUnpaid = o.payment === 'Unpaid'
    return (
      <div className="flex items-center justify-end gap-2">
        {isUnpaid && canMarkPaid && (
          <button
            onClick={() => markPaid(o.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            <IconCheck size={14} /> Mark Paid
          </button>
        )}
        {isUnpaid && canCancel && (
          <button
            onClick={() => setCancelTarget(o)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
          >
            <IconClose size={14} /> Cancel
          </button>
        )}
      </div>
    )
  }

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

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              filter === f
                ? 'border-gold/60 bg-gold/12 text-gold'
                : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
            }`}
          >
            {f} <span className="text-xs opacity-70">({filterCount(f)})</span>
          </button>
        ))}
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
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Time</th>
                    <th className="px-5 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-line">
                  {rows.map((o) => (
                    <tr key={o.id} className={`transition hover:bg-white/[0.02] ${o.cancelled ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-4 font-semibold text-gold">{o.id}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-lg bg-white/5 px-2 py-1 text-xs font-medium text-cream ring-1 ring-ink-line">
                          T{o.table}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-cream">{o.waiter}</td>
                      <td className="max-w-[240px] px-5 py-4 text-cream-dim">
                        <span className={`line-clamp-1 ${o.cancelled ? 'line-through' : ''}`}>
                          {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-cream">
                        {money(orderTotal(o.items, o.discount?.amount).total)}
                      </td>
                      <td className="px-5 py-4">
                        {o.cancelled ? <CancelledBadge /> : <PaymentBadge status={o.payment} />}
                      </td>
                      <td className="px-5 py-4 text-cream-dim">{time(o.createdAt)}</td>
                      <td className="px-5 py-4 text-right">
                        <OrderActions o={o} />
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
              <div key={o.id} className={`card p-4 ${o.cancelled ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gold">{o.id}</span>
                  {o.cancelled ? <CancelledBadge /> : <PaymentBadge status={o.payment} />}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-cream-dim">
                  <span className="rounded bg-white/5 px-2 py-0.5 ring-1 ring-ink-line">
                    Table {o.table}
                  </span>
                  <span>{o.waiter}</span>
                  <span>· {time(o.createdAt)}</span>
                </div>
                <p className={`mt-2 text-sm text-cream-dim ${o.cancelled ? 'line-through' : ''}`}>
                  {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-ink-line pt-3">
                  <span className="font-serif text-lg font-semibold text-cream">
                    {money(orderTotal(o.items, o.discount?.amount).total)}
                  </span>
                  <OrderActions o={o} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Cancellation log — Admin only */}
      {canCancel && auditLog.length > 0 && (
        <div className="card mt-6 overflow-hidden">
          <div className="border-b border-ink-line p-5">
            <h3 className="font-serif text-xl text-cream">Cancellation Log</h3>
            <p className="text-xs text-cream-dim">{auditLog.length} cancellation(s) recorded this session.</p>
          </div>
          <div className="divide-y divide-ink-line">
            {auditLog.map((a) => (
              <div key={a.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-cream">
                    <span className="font-semibold text-gold">{a.orderId}</span> · {a.reason}
                  </p>
                  {a.notes && <p className="truncate text-xs text-cream-dim">{a.notes}</p>}
                </div>
                <div className="text-xs text-cream-dim sm:text-right">
                  by <span className="text-cream">{a.by}</span> ({a.role}) · {time(a.at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {cancelTarget && (
        <CancelModal
          order={cancelTarget}
          orderTotal={orderTotal}
          onConfirm={({ reason, notes }) => {
            cancelOrder(cancelTarget.id, { reason, notes })
            setCancelTarget(null)
          }}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  )
}
