import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, PaymentBadge, EmptyState } from '../components/ui.jsx'
import { money, time } from '../utils/format.js'
import { tableLabel } from '../data/mockData.js'
import { IconOrders, IconSearch, IconCheck, IconClose, IconWallet, IconPrint } from '../components/Icons.jsx'
import { canModify, hasAccess } from '../config/permissions.js'
import PaymentModal from '../components/PaymentModal.jsx'
import MarkAsUdhaarModal from '../components/MarkAsUdhaarModal.jsx'
import MarkAsComplimentaryModal from '../components/MarkAsComplimentaryModal.jsx'
// Reuse the same slip the POS/Billing pages print — a running (unpaid) order can
// be printed as a "bill to pay" here without settling it (waiter takes it to the
// table; cash is collected and Mark as Paid pressed later).
import { Receipt } from './Billing.jsx'

const FILTERS = ['All', 'Paid', 'Unpaid', 'Udhaar', 'Complimentary', 'Cancelled']
const CANCEL_REASONS = ['Customer Request', 'Wrong Order', 'Out of Stock', 'Other']

// Shared shape for the row actions; each button supplies its own gradient.
// Colours follow PaymentBadge so a button and the badge it produces match.
const ACTION_BTN =
  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white ' +
  'shadow-sm transition-all duration-200 hover:shadow-lg active:scale-95 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm'

function CancelledBadge() {
  return (
    <span className="badge bg-rose-500/12 text-rose-300 ring-1 ring-rose-500/30">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
      Cancelled
    </span>
  )
}

// Admin-only cancel dialog — reason required, no PIN (role-gated).
function CancelModal({ order, orderTotal, materialLoss = 0, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const { total } = orderTotal(order.items, order.discount?.amount, order.gstRate)

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
              <span className="text-sm text-cream-dim">{tableLabel(order.table)}</span>
            </div>
            <p className="mt-2 text-xs text-cream-dim">
              {order.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
            </p>
            <div className="mt-2 border-t border-ink-line pt-2 text-right">
              <span className="font-serif text-lg font-semibold text-cream">{money(total)}</span>
            </div>
          </div>

          {/* Material write-off: cancelling does NOT restock — the recipe
              ingredients already consumed are booked as a loss. */}
          {materialLoss > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-3 py-2 text-sm">
              <span className="text-cream-dim">Material loss (ingredients wasted)</span>
              <span className="font-semibold text-rose-300">{money(materialLoss)}</span>
            </div>
          )}

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
              title={reason ? 'Cancel this order' : 'Select a reason first'}
              className="flex-1 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 py-3 font-semibold text-white transition-all duration-200 hover:from-rose-400 hover:to-red-500 hover:shadow-lg hover:shadow-rose-500/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
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
  const { orders, orderTotal, markPaid, cancelOrder, orderMaterialLoss, markOrderUdhaar, markOrderComplimentary, onlineAccounts, auditLog, user } = useApp()
  const canMarkPaid = user && canModify(user.role, 'orders')
  // Printing a bill doesn't mutate the order, so it's allowed for anyone who can
  // even VIEW orders (Cashier/Admin settle, but a Manager on 'view' can still
  // hand a customer their bill) — a wider gate than the settle actions above.
  const canPrintBill = user && hasAccess(user.role, 'orders')
  const canCancel = user && canModify(user.role, 'orderCancel')
  const canUdhaar = user && canModify(user.role, 'receivables') // Manager/Admin: put a bill on account
  const canComp = user && canModify(user.role, 'orderComplimentary') // Manager/Admin: free/on-the-house
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [payTarget, setPayTarget] = useState(null) // unpaid order awaiting payment
  const [billTarget, setBillTarget] = useState(null) // unpaid order → print bill only (no settle)
  const [udhaarTarget, setUdhaarTarget] = useState(null) // unpaid order → on-account
  const [compTarget, setCompTarget] = useState(null) // unpaid order → complimentary

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
          String(o.table).includes(q) ||
          tableLabel(o.table).toLowerCase().includes(q)
        return matchFilter && matchQuery
      }),
    [orders, filter, query],
  )

  const filterCount = (f) => {
    if (f === 'All') return orders.length
    if (f === 'Cancelled') return orders.filter((o) => o.cancelled).length
    return orders.filter((o) => o.payment === f && !o.cancelled).length
  }

  const cancelLog = useMemo(() => auditLog.filter((a) => a.action === 'CANCELLED'), [auditLog])

  // Actions shared by desktop rows and mobile cards.
  const OrderActions = ({ o }) => {
    if (o.cancelled) return null
    const isUnpaid = o.payment === 'Unpaid'
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isUnpaid && canPrintBill && (
          <button
            onClick={() => setBillTarget(o)}
            title="Print the bill for this running order — does NOT mark it paid"
            className={`${ACTION_BTN} bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 hover:shadow-amber-500/40`}
          >
            <IconPrint size={14} /> Print Bill
          </button>
        )}
        {isUnpaid && canMarkPaid && (
          <button
            onClick={() => setPayTarget(o)}
            title="Mark this order as paid (Cash / Card / Online)"
            className={`${ACTION_BTN} bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 hover:shadow-emerald-500/40`}
          >
            <IconCheck size={14} /> Mark as Paid
          </button>
        )}
        {isUnpaid && canUdhaar && (
          <button
            onClick={() => setUdhaarTarget(o)}
            title="Put this bill on a customer's Udhaar (credit) account"
            className={`${ACTION_BTN} bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 hover:shadow-sky-500/40`}
          >
            <IconWallet size={14} /> Udhaar
          </button>
        )}
        {isUnpaid && canComp && (
          <button
            onClick={() => setCompTarget(o)}
            title="Mark this order as complimentary (free / on-the-house)"
            className={`${ACTION_BTN} bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 hover:shadow-violet-500/40`}
          >
            🎁 Complimentary
          </button>
        )}
        {isUnpaid && canCancel && (
          <button
            onClick={() => setCancelTarget(o)}
            title="Cancel this order (reason required, recorded in the audit log)"
            className={`${ACTION_BTN} bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 hover:shadow-rose-500/40`}
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

      {/* Total material written off across the cancelled orders in view. */}
      {filter === 'Cancelled' && rows.length > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-3">
          <span className="text-sm text-cream-dim">
            Total material loss · {rows.length} cancelled order(s)
          </span>
          <span className="font-serif text-xl font-semibold text-rose-300">
            {money(rows.reduce((s, o) => s + (o.materialLoss || 0), 0))}
          </span>
        </div>
      )}

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
                    {filter === 'Cancelled' && (
                      <th className="px-5 py-4 text-right font-semibold">Loss</th>
                    )}
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
                          {tableLabel(o.table)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-cream">{o.waiter}</td>
                      <td className="max-w-[240px] px-5 py-4 text-cream-dim">
                        <span className={`line-clamp-1 ${o.cancelled ? 'line-through' : ''}`}>
                          {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-cream">
                        {money(orderTotal(o.items, o.discount?.amount, o.gstRate).total)}
                      </td>
                      {filter === 'Cancelled' && (
                        <td className="px-5 py-4 text-right font-semibold text-rose-300">
                          {o.materialLoss ? money(o.materialLoss) : '—'}
                        </td>
                      )}
                      <td className="px-5 py-4">
                        {o.cancelled ? <CancelledBadge /> : <PaymentBadge status={o.payment} />}
                        {o.payment === 'Udhaar' && o.udhaarCustomerName && (
                          <span className="mt-1 block text-xs text-cream-dim">📋 {o.udhaarCustomerName}</span>
                        )}
                        {o.payment === 'Complimentary' && o.complimentary?.orderedBy && (
                          <span className="mt-1 block text-xs text-cream-dim">🎁 {o.complimentary.orderedBy}</span>
                        )}
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
                  <div className="text-right">
                    {o.cancelled ? <CancelledBadge /> : <PaymentBadge status={o.payment} />}
                    {o.payment === 'Udhaar' && o.udhaarCustomerName && (
                      <span className="mt-1 block text-xs text-cream-dim">📋 {o.udhaarCustomerName}</span>
                    )}
                    {o.payment === 'Complimentary' && o.complimentary?.orderedBy && (
                      <span className="mt-1 block text-xs text-cream-dim">🎁 {o.complimentary.orderedBy}</span>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-cream-dim">
                  <span className="rounded bg-white/5 px-2 py-0.5 ring-1 ring-ink-line">
                    {tableLabel(o.table)}
                  </span>
                  <span>{o.waiter}</span>
                  <span>· {time(o.createdAt)}</span>
                </div>
                <p className={`mt-2 text-sm text-cream-dim ${o.cancelled ? 'line-through' : ''}`}>
                  {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-ink-line pt-3">
                  <span className="font-serif text-lg font-semibold text-cream">
                    {money(orderTotal(o.items, o.discount?.amount, o.gstRate).total)}
                  </span>
                  <OrderActions o={o} />
                </div>
                {o.cancelled && o.materialLoss > 0 && (
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-cream-dim">Material loss</span>
                    <span className="font-semibold text-rose-300">{money(o.materialLoss)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Cancellation log — Admin only. Filter to cancellations; the shared
          audit log also carries discount/receivable/handover/udhaar entries. */}
      {canCancel && cancelLog.length > 0 && (
        <div className="card mt-6 overflow-hidden">
          <div className="border-b border-ink-line p-5">
            <h3 className="font-serif text-xl text-cream">Cancellation Log</h3>
            <p className="text-xs text-cream-dim">{cancelLog.length} cancellation(s) recorded this session.</p>
          </div>
          <div className="divide-y divide-ink-line">
            {cancelLog.map((a) => (
              <div key={a.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-cream">
                    <span className="font-semibold text-gold">{a.orderId}</span> · {a.reason}
                  </p>
                  {a.notes && <p className="truncate text-xs text-cream-dim">{a.notes}</p>}
                </div>
                <div className="text-xs text-cream-dim sm:text-right">
                  {a.materialLoss > 0 && (
                    <span className="mb-0.5 block font-semibold text-rose-300">
                      Loss {money(a.materialLoss)}
                    </span>
                  )}
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
          materialLoss={orderMaterialLoss(cancelTarget.items)}
          onConfirm={({ reason, notes }) => {
            cancelOrder(cancelTarget.id, { reason, notes })
            setCancelTarget(null)
          }}
          onClose={() => setCancelTarget(null)}
        />
      )}

      {/* Print Bill → the printable slip, but print-only: canMarkPaid=false hides
          the in-slip "Mark Paid" button so settling stays with the dedicated
          "Mark as Paid" flow (which collects the payment method). */}
      {billTarget && (
        <Receipt
          order={billTarget}
          orderTotal={orderTotal}
          canMarkPaid={false}
          onClose={() => setBillTarget(null)}
        />
      )}

      {/* Mark as Paid → same payment dialog as the POS "Pay Now" flow. */}
      {payTarget && (
        <PaymentModal
          total={orderTotal(payTarget.items, payTarget.discount?.amount, payTarget.gstRate).total}
          onlineAccounts={onlineAccounts}
          onConfirm={(method, _amount, account) => {
            markPaid(payTarget.id, method, account)
            setPayTarget(null)
          }}
          onClose={() => setPayTarget(null)}
        />
      )}

      {/* Mark as Udhaar → adds the bill to a customer's Receivable (credit ledger). */}
      {udhaarTarget && (
        <MarkAsUdhaarModal
          order={udhaarTarget}
          onConfirm={(data) => {
            const res = markOrderUdhaar(udhaarTarget.id, data)
            if (res?.error) return
            setUdhaarTarget(null)
          }}
          onClose={() => setUdhaarTarget(null)}
        />
      )}

      {/* Mark as Complimentary → free / on-the-house (no cash, no due). */}
      {compTarget && (
        <MarkAsComplimentaryModal
          order={compTarget}
          onConfirm={(data) => {
            const res = markOrderComplimentary(compTarget.id, data)
            if (res?.error) return
            setCompTarget(null)
          }}
          onClose={() => setCompTarget(null)}
        />
      )}
    </div>
  )
}
