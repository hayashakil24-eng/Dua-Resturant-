import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, PaymentBadge, EmptyState } from '../components/ui.jsx'
import { money, time } from '../utils/format.js'
import { tableLabel } from '../data/mockData.js'
import { IconOrders, IconSearch, IconCheck, IconClose, IconWallet, IconPrint, IconTable } from '../components/Icons.jsx'
import { canModify, hasAccess } from '../config/permissions.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import PaymentModal from '../components/PaymentModal.jsx'
import ShiftTableModal from '../components/ShiftTableModal.jsx'
import MarkAsUdhaarModal from '../components/MarkAsUdhaarModal.jsx'
import MarkAsComplimentaryModal from '../components/MarkAsComplimentaryModal.jsx'
// Reuse the same slip the POS/Billing pages print — a running (unpaid) order can
// be printed as a "bill to pay" here without settling it (waiter takes it to the
// table; cash is collected and Mark as Paid pressed later).
import { Receipt } from './Billing.jsx'

const FILTERS = ['All', 'Paid', 'Unpaid', 'Udhaar', 'Complimentary', 'Cancelled']
const CANCEL_REASONS = ['Customer Request', 'Wrong Order', 'Out of Stock', 'Other']
const ORDERS_PAGE_SIZE = 20

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
  // Ingredients are only wasted if the dish was actually cooked. Defaults to the
  // order's ready state; the "Mark as Ready" button lets the Manager/Admin
  // confirm it was cooked (then the material loss applies).
  const [cooked, setCooked] = useState(order.kitchen === 'Ready')
  useEscapeKey(onClose)
  const { total } = orderTotal(order.items, order.discount?.amount, order.gstRate)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
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

          {/* Material write-off applies ONLY when the dish was cooked — a
              not-yet-cooked order wastes nothing, so its ingredients restock. */}
          {cooked ? (
            materialLoss > 0 && (
              <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-3 py-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-cream-dim">Material loss (ingredients wasted)</span>
                  <span className="font-semibold text-rose-300">{money(materialLoss)}</span>
                </div>
                {/* Revert a mistaken "Mark as Cooked" — but not when the order is
                    genuinely Ready on the KDS (then it really was cooked). */}
                {order.kitchen !== 'Ready' && (
                  <button
                    onClick={() => setCooked(false)}
                    className="mt-1.5 text-[11px] text-cream-dim underline underline-offset-2 transition hover:text-cream"
                  >
                    Undo — not cooked (no loss)
                  </button>
                )}
              </div>
            )
          ) : (
            materialLoss > 0 && (
              <div className="mt-3 rounded-xl border border-ink-line bg-ink-soft px-3 py-2.5">
                <p className="text-xs text-cream-dim">
                  Not cooked yet — no ingredients wasted. If it was already made, mark it cooked to
                  book the material loss.
                </p>
                <button
                  onClick={() => setCooked(true)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/15"
                >
                  <IconCheck size={14} /> Mark as Cooked
                </button>
              </div>
            )
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
              onClick={() => onConfirm({ reason, notes: notes.trim(), cooked })}
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
  const { orders, orderTotal, markPaid, cancelOrder, orderMaterialLoss, markOrderUdhaar, markOrderComplimentary, shiftOrderTable, onlineAccounts, auditLog, user } = useApp()
  // Admin oversees orders but doesn't personally settle bills — that's a
  // Cashier action — so the button is hidden for Admin even though they keep
  // full edit access otherwise (table shift, etc.).
  const canMarkPaid = user && user.role !== 'Admin' && canModify(user.role, 'orders')
  // Re-seating a running order is a running-order edit — same gate as settling
  // used to share, but Admin keeps this one even without Mark as Paid.
  const canShiftTable = user && canModify(user.role, 'orders')
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
  const [shiftTarget, setShiftTarget] = useState(null) // unpaid order → move to another table
  const [billTarget, setBillTarget] = useState(null) // unpaid order → print bill only (no settle)
  const [udhaarTarget, setUdhaarTarget] = useState(null) // unpaid order → on-account
  const [compTarget, setCompTarget] = useState(null) // unpaid order → complimentary
  const [detailTarget, setDetailTarget] = useState(null) // order details drawer
  const [visibleCount, setVisibleCount] = useState(ORDERS_PAGE_SIZE)
  const [logVisibleCount, setLogVisibleCount] = useState(ORDERS_PAGE_SIZE)

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

  const shownRows = rows.slice(0, visibleCount)

  const cancelLog = useMemo(() => auditLog.filter((a) => a.action === 'CANCELLED'), [auditLog])

  // Audit entries record the server cuid, but every other surface shows the
  // human order number — translate back rather than printing a raw id. Null
  // when the order isn't in the current list, so the row shows just the reason.
  const orderNumberOf = useMemo(() => {
    const byServerId = new Map(orders.map((o) => [o.serverId, o.id]))
    return (serverId) => byServerId.get(serverId) ?? null
  }, [orders])

  // Actions shown in the order details drawer. A flat stack of six identical
  // full-width buttons reads as a wall of buttons, not a designed UI — so
  // instead: one clear primary action (Mark as Paid), the alternate/utility
  // actions as a compact icon grid, and Cancel set apart below a divider as a
  // quieter outlined control (still rose-toned, just not shouting as loud as
  // the rest — it's the one action here that's rare and destructive).
  // `onClose` closes the drawer for any action that mutates the order (its
  // snapshot in the drawer would otherwise go stale — table shifted, status
  // changed, etc.) — except Print Bill, which changes nothing about the order
  // itself, so there's no reason to lose the drawer over it.
  const OrderActions = ({ o, onClose }) => {
    if (o.cancelled) return null
    const isUnpaid = o.payment === 'Unpaid'
    if (!isUnpaid) return null

    const secondary = [
      canUdhaar && {
        key: 'udhaar',
        icon: <IconWallet size={18} />,
        label: 'Udhaar',
        onClick: () => {
          setUdhaarTarget(o)
          onClose()
        },
      },
      canComp && {
        key: 'comp',
        icon: <span className="text-base leading-none">🎁</span>,
        label: 'Complimentary',
        onClick: () => {
          setCompTarget(o)
          onClose()
        },
      },
      canPrintBill && {
        key: 'print',
        icon: <IconPrint size={18} />,
        label: 'Print Bill',
        onClick: () => setBillTarget(o),
      },
      canShiftTable && {
        key: 'shift',
        icon: <IconTable size={18} />,
        label: 'Shift Table',
        onClick: () => {
          setShiftTarget(o)
          onClose()
        },
      },
    ].filter(Boolean)

    return (
      <div className="space-y-4">
        {canMarkPaid && (
          <button onClick={() => { setPayTarget(o); onClose() }} className="btn-gold w-full py-3 text-sm">
            <IconCheck size={16} /> Mark as Paid
          </button>
        )}

        {secondary.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {secondary.map((a) => (
              <button
                key={a.key}
                onClick={a.onClick}
                className="btn-ghost flex-col gap-1.5 py-3 text-xs"
              >
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>
        )}

        {canCancel && (
          <div className="border-t border-ink-line pt-4">
            <button
              onClick={() => {
                setCancelTarget(o)
                onClose()
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10"
            >
              <IconClose size={16} /> Cancel Order
            </button>
          </div>
        )}
      </div>
    )
  }

  // Order details drawer — slides in from the right when a row/card is
  // clicked, replacing the old inline per-row action pills. Full order
  // context (items, totals, status) plus the actions above, all in one place.
  const OrderDetailsDrawer = ({ order, onClose }) => {
    useEscapeKey(onClose)
    const { subtotal, tax, discount, total } = orderTotal(order.items, order.discount?.amount, order.gstRate)
    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <aside className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slide-in-right flex-col border-l border-ink-line bg-ink-soft">
          <div className="flex items-start justify-between border-b border-ink-line p-6">
            <div>
              <h3 className="font-serif text-2xl text-cream">{order.id}</h3>
              <p className="mt-0.5 text-xs text-cream-dim">
                {tableLabel(order.table)} · {order.waiter} · {time(order.createdAt)}
              </p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <div className="flex items-center gap-2">
              {order.cancelled ? <CancelledBadge /> : <PaymentBadge status={order.payment} />}
              {order.payment === 'Udhaar' && order.udhaarCustomerName && (
                <span className="text-xs text-cream-dim">📋 {order.udhaarCustomerName}</span>
              )}
              {order.payment === 'Complimentary' && order.complimentary?.orderedBy && (
                <span className="text-xs text-cream-dim">🎁 {order.complimentary.orderedBy}</span>
              )}
            </div>

            <ul className="mt-5 divide-y divide-ink-line">
              {order.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className={order.cancelled ? 'text-cream-dim line-through' : 'text-cream'}>
                    {it.name} <span className="text-cream-dim">×{it.qty}</span>
                  </span>
                  <span className="font-semibold text-cream">{money(it.price * it.qty)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-3 space-y-1 border-t border-ink-line pt-3 text-sm">
              <div className="flex justify-between text-cream-dim">
                <span>Subtotal</span>
                <span className="text-cream">{money(subtotal)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-cream-dim">
                  <span>GST</span>
                  <span className="text-cream">{money(tax)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-emerald-300">
                  <span>
                    Discount
                    {order.discount?.percent ? ` ${order.discount.percent}%` : ''}
                    {order.discount?.reason ? ` (${order.discount.reason})` : ''}
                  </span>
                  <span>- {money(discount)}</span>
                </div>
              )}
              {order.cancelled && order.materialLoss > 0 && (
                <div className="flex justify-between text-rose-300">
                  <span>Material loss</span>
                  <span>{money(order.materialLoss)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="font-serif text-lg text-cream">Total</span>
                <span className="font-serif text-2xl font-semibold text-gold">{money(total)}</span>
              </div>
            </div>
          </div>

          {!order.cancelled && (
            <div className="border-t border-ink-line p-6">
              <OrderActions o={order} onClose={onClose} />
            </div>
          )}
        </aside>
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
            onChange={(e) => {
              setQuery(e.target.value)
              setVisibleCount(ORDERS_PAGE_SIZE)
            }}
          />
        </div>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f)
              setVisibleCount(ORDERS_PAGE_SIZE)
            }}
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-line">
                  {shownRows.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => setDetailTarget(o)}
                      className={`cursor-pointer transition hover:bg-white/[0.02] ${o.cancelled ? 'opacity-60' : ''}`}
                    >
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {shownRows.map((o) => (
              <button
                key={o.id}
                onClick={() => setDetailTarget(o)}
                className={`card w-full p-4 text-left transition hover:border-gold/40 ${o.cancelled ? 'opacity-60' : ''}`}
              >
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
                </div>
                {o.cancelled && o.materialLoss > 0 && (
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-cream-dim">Material loss</span>
                    <span className="font-semibold text-rose-300">{money(o.materialLoss)}</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          {shownRows.length < rows.length && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setVisibleCount((c) => c + ORDERS_PAGE_SIZE)}
                className="btn-ghost px-5 py-2 text-sm"
              >
                Load more · {shownRows.length}/{rows.length}
              </button>
            </div>
          )}
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
            {cancelLog.slice(0, logVisibleCount).map((a) => {
              const orderNo = orderNumberOf(a.orderId)
              return (
              <div key={a.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-cream">
                    {orderNo && <span className="font-semibold text-gold">{orderNo} · </span>}
                    {a.reason}
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
              )
            })}
          </div>
          {logVisibleCount < cancelLog.length && (
            <div className="flex justify-center border-t border-ink-line p-4">
              <button
                onClick={() => setLogVisibleCount((c) => c + ORDERS_PAGE_SIZE)}
                className="btn-ghost px-5 py-2 text-sm"
              >
                Load more · {Math.min(logVisibleCount, cancelLog.length)}/{cancelLog.length}
              </button>
            </div>
          )}
        </div>
      )}

      {detailTarget && (
        <OrderDetailsDrawer order={detailTarget} onClose={() => setDetailTarget(null)} />
      )}

      {cancelTarget && (
        <CancelModal
          order={cancelTarget}
          orderTotal={orderTotal}
          materialLoss={orderMaterialLoss(cancelTarget.items)}
          onConfirm={({ reason, notes, cooked }) => {
            cancelOrder(cancelTarget.id, { reason, notes, cooked })
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

      {/* Shift Table → re-seat a running order onto another table. */}
      {shiftTarget && (
        <ShiftTableModal
          order={shiftTarget}
          onConfirm={async (tableId) => {
            const res = await shiftOrderTable(shiftTarget.id, tableId)
            if (res?.error) return
            setShiftTarget(null)
          }}
          onClose={() => setShiftTarget(null)}
        />
      )}

      {/* Mark as Udhaar → adds the bill to a customer's Receivable (credit ledger). */}
      {udhaarTarget && (
        <MarkAsUdhaarModal
          order={udhaarTarget}
          onConfirm={async (data) => {
            const res = await markOrderUdhaar(udhaarTarget.id, data)
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
          onConfirm={async (data) => {
            const res = await markOrderComplimentary(compTarget.id, data)
            if (res?.error) return
            setCompTarget(null)
          }}
          onClose={() => setCompTarget(null)}
        />
      )}
    </div>
  )
}
