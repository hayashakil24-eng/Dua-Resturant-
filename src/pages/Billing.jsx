import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, PaymentBadge, EmptyState } from '../components/ui.jsx'
import { money, time, dateLong } from '../utils/format.js'
import { safePrint } from '../utils/print.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { TAX_RATE, tableLabel } from '../data/mockData.js'
import DiscountModal from '../components/DiscountModal.jsx'
import Logo from '../components/Logo.jsx'
import { IconReceipt, IconPrint, IconCheck, IconClose, IconWallet } from '../components/Icons.jsx'

export function Receipt({
  order,
  orderTotal,
  onClose,
  onMarkPaid,
  canMarkPaid = true,
  canDiscount = false,
  onApplyDiscount = () => {},
  onRemoveDiscount = () => {},
}) {
  const { subtotal, tax, discount, total } = orderTotal(order.items, order.discount?.amount)
  const [printing, setPrinting] = useState(false)
  useEscapeKey(onClose)

  // Guarded print — ignores rapid repeat clicks so the bill prints once.
  const handlePrint = () => {
    if (safePrint('print-receipt')) {
      setPrinting(true)
      setTimeout(() => setPrinting(false), 1500)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm no-print" onClick={onClose} />
      {/* Flex column capped at the viewport so the sticky footer buttons stay
          in view on short screens; the slip scrolls instead of pushing them off. */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-sm flex-col">
        {/* Scrollable content — min-h-0 lets it shrink below the slip height so
            overflow-y-auto actually kicks in inside the flex column. */}
        <div className="min-h-0 overflow-y-auto">
          {/* Printable slip */}
          <div
            id="printable-receipt"
            className="rounded-2xl bg-white p-6 text-[#3E2723] shadow-lift border border-[#E8DCC4]"
            style={{ fontFamily: 'ui-monospace, monospace' }}
          >
            <div className="text-center">
              <div className="flex justify-center">
                <div className="font-serif text-2xl font-bold tracking-wide" style={{ color: '#C9A961' }}>
                  Cafe Ali
                </div>
              </div>
              <p className="mt-2 text-[11px] text-[#5D4037]">
                Hawksbay Road, Karachi · 021-111-ALI
              </p>
            </div>

            <div className="my-4 border-t border-dashed border-[#E8DCC4]" />

            <div className="grid grid-cols-2 gap-1 text-xs text-[#3E2723]">
              <span>Receipt</span>
              <span className="text-right font-bold">{order.id}</span>
              <span>Date</span>
              <span className="text-right">{new Date(order.createdAt).toLocaleDateString('en-PK')}</span>
              <span>Time</span>
              <span className="text-right">{time(order.createdAt)}</span>
              <span>Table</span>
              <span className="text-right">{tableLabel(order.table)}</span>
              <span>Waiter</span>
              <span className="text-right">{order.waiter}</span>
            </div>

            <div className="my-4 border-t border-dashed border-[#E8DCC4]" />

            <table className="w-full text-xs text-[#3E2723]">
              <thead>
                <tr className="text-left text-[#3E2723]/80">
                  <th className="pb-1 font-medium">Item</th>
                  <th className="pb-1 text-center font-medium">Qty</th>
                  <th className="pb-1 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id} className="align-top">
                    <td className="py-0.5 pr-2">{it.name}</td>
                    <td className="py-0.5 text-center">{it.qty}</td>
                    <td className="py-0.5 text-right font-bold">{money(it.price * it.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="my-4 border-t border-dashed border-[#E8DCC4]" />

            <div className="space-y-1 text-xs text-[#3E2723]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-bold">{money(subtotal)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between">
                  <span>GST ({Math.round(TAX_RATE * 100)}%)</span>
                  <span className="font-bold">{money(tax)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between">
                  <span>Discount{order.discount?.reason ? ` (${order.discount.reason})` : ''}</span>
                  <span className="font-bold">- {money(discount)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-[#E8DCC4] pt-1 text-sm font-bold">
                <span>TOTAL</span>
                <span>{money(total)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Payment</span>
                <span className="font-bold">
                  {order.payment}{order.payment === 'Paid' ? ` · ${order.method}` : ''}
                </span>
              </div>
            </div>

            <div className="my-4 border-t border-dashed border-[#E8DCC4]" />
            <p className="text-center text-[11px] text-[#5D4037]">
              Thank you for dining with us!
              <br />
              Please come again — Cafe Ali
            </p>

            {/* Software credit — subtle, kept small so it never competes with the bill. */}
            <div className="mt-3 border-t border-dashed border-[#E8DCC4] pt-2 text-center">
              <p className="text-[12px] text-[#8D6E63]">
                Software by SoftDap | Support: +92 334 3207049
              </p>
            </div>
          </div>
        </div>

        {/* Sticky footer — flex-shrink-0 keeps these controls in view even when
            the slip above scrolls, so they never get clipped on short screens. */}
        <div className="flex-shrink-0">
          {/* Discount controls (Admin/Manager, unpaid orders only) */}
          {canDiscount && order.payment === 'Unpaid' && !order.cancelled && (
            <div className="mt-4 no-print">
              {order.discount ? (
                <div className="flex items-center justify-between rounded-xl border border-ink-line bg-ink-soft px-4 py-2.5">
                  <span className="text-xs text-cream-dim">
                    Discount {money(order.discount.amount)} · by {order.discount.by}
                  </span>
                  <button
                    onClick={() => onRemoveDiscount(order.id)}
                    className="text-xs font-semibold text-rose-300 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={onApplyDiscount}
                  className="w-full rounded-xl border border-gold/40 bg-gold/10 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/20"
                >
                  <span className="inline-flex items-center gap-2">
                    <IconWallet size={16} /> Apply Discount
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="mt-4 flex gap-3 no-print">
            {order.payment === 'Unpaid' && canMarkPaid && (
              <button
                onClick={() => onMarkPaid(order.id)}
                className="flex-1 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
              >
                <span className="inline-flex items-center gap-2">
                  <IconCheck size={16} /> Mark Paid
                </span>
              </button>
            )}
            <button
              onClick={handlePrint}
              disabled={printing}
              className="btn-gold flex-1 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconPrint size={18} /> {printing ? 'Printing…' : 'Print'}
            </button>
            <button onClick={onClose} className="btn-ghost px-4">
              <IconClose size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { canModify } from '../config/permissions.js'

export default function Billing() {
  const { orders, orderTotal, markPaid, applyDiscount, removeDiscount, user } = useApp()
  // Track by id so the open receipt reflects live discount / paid changes.
  const [activeId, setActiveId] = useState(null)
  const [showDiscount, setShowDiscount] = useState(false)
  const active = activeId ? orders.find((o) => o.id === activeId) : null

  const canDiscount = Boolean(user && canModify(user.role, 'discount'))

  const paidTotal = orders
    .filter((o) => o.payment === 'Paid' && !o.cancelled)
    .reduce((s, o) => s + orderTotal(o.items, o.discount?.amount).total, 0)
  const unpaidTotal = orders
    .filter((o) => o.payment === 'Unpaid' && !o.cancelled)
    .reduce((s, o) => s + orderTotal(o.items, o.discount?.amount).total, 0)

  const handleApplyDiscount = (data) => {
    if (activeId) applyDiscount(activeId, data)
    setShowDiscount(false)
  }

  return (
    <div>
      <PageHeader title="Billing & Receipts" subtitle="Generate and print receipts for any order." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-widest text-cream-dim">Collected</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-emerald-300">{money(paidTotal)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-widest text-cream-dim">Outstanding</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-amber-300">{money(unpaidTotal)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-widest text-cream-dim">Receipts</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-cream">{orders.length}</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={IconReceipt} title="No receipts yet" hint="Placed orders will appear here for billing." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => setActiveId(o.id)}
              className="card group p-5 text-left transition hover:border-gold/40 hover:shadow-gold"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/20">
                  <IconReceipt size={20} />
                </span>
                {o.cancelled ? (
                  <span className="badge bg-rose-500/12 text-rose-300 ring-1 ring-rose-500/30">Cancelled</span>
                ) : (
                  <PaymentBadge status={o.payment} />
                )}
              </div>
              <p className="mt-4 font-semibold text-gold">{o.id}</p>
              <p className="text-xs text-cream-dim">
                {tableLabel(o.table)} · {o.waiter} · {time(o.createdAt)}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-ink-line pt-3">
                <span className="font-serif text-xl font-semibold text-cream">
                  {money(orderTotal(o.items, o.discount?.amount).total)}
                  {o.discount && (
                    <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                      −{money(o.discount.amount)}
                    </span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold opacity-0 transition group-hover:opacity-100">
                  <IconPrint size={14} /> View receipt
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {active && (
        <Receipt
          order={active}
          orderTotal={orderTotal}
          onClose={() => setActiveId(null)}
          onMarkPaid={(id) => markPaid(id)}
          canMarkPaid={user && canModify(user.role, 'billing') && !active.cancelled}
          canDiscount={canDiscount}
          onApplyDiscount={() => setShowDiscount(true)}
          onRemoveDiscount={(id) => removeDiscount(id)}
        />
      )}

      {showDiscount && active && (
        <DiscountModal
          order={active}
          gross={orderTotal(active.items).total}
          onApply={handleApplyDiscount}
          onClose={() => setShowDiscount(false)}
        />
      )}
    </div>
  )
}
