import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, PaymentBadge, EmptyState } from '../components/ui.jsx'
import { money, time, dateLong } from '../utils/format.js'
import { TAX_RATE } from '../data/mockData.js'
import Logo from '../components/Logo.jsx'
import { IconReceipt, IconPrint, IconCheck, IconClose } from '../components/Icons.jsx'

export function Receipt({ order, orderTotal, onClose, onMarkPaid, canMarkPaid = true }) {
  const { subtotal, tax, total } = orderTotal(order.items)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm no-print" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm">
        {/* Printable slip */}
        <div
          id="printable-receipt"
          className="rounded-2xl bg-cream p-6 text-ink shadow-lift"
          style={{ fontFamily: 'ui-monospace, monospace' }}
        >
          <div className="text-center">
            <div className="flex justify-center">
              <div className="font-serif text-2xl font-bold tracking-wide" style={{ color: '#8C6F1A' }}>
                Dua Restaurant
              </div>
            </div>
            <p className="text-[11px] uppercase tracking-[0.3em]" style={{ color: '#8C6F1A' }}>
              Café Ali
            </p>
            <p className="mt-2 text-[11px] text-neutral-600">
              Hawksbay Road, Karachi · 021-111-DUA
            </p>
          </div>

          <div className="my-4 border-t border-dashed border-neutral-400" />

          <div className="grid grid-cols-2 gap-1 text-xs text-neutral-700">
            <span>Receipt</span>
            <span className="text-right font-semibold text-ink">{order.id}</span>
            <span>Date</span>
            <span className="text-right">{new Date(order.createdAt).toLocaleDateString('en-PK')}</span>
            <span>Time</span>
            <span className="text-right">{time(order.createdAt)}</span>
            <span>Table</span>
            <span className="text-right">#{order.table}</span>
            <span>Waiter</span>
            <span className="text-right">{order.waiter}</span>
          </div>

          <div className="my-4 border-t border-dashed border-neutral-400" />

          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="pb-1 font-medium">Item</th>
                <th className="pb-1 text-center font-medium">Qty</th>
                <th className="pb-1 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id} className="align-top">
                  <td className="py-0.5 pr-2 text-ink">{it.name}</td>
                  <td className="py-0.5 text-center text-neutral-700">{it.qty}</td>
                  <td className="py-0.5 text-right text-ink">{money(it.price * it.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="my-4 border-t border-dashed border-neutral-400" />

          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-neutral-700">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="flex justify-between text-neutral-700">
              <span>GST ({Math.round(TAX_RATE * 100)}%)</span>
              <span>{money(tax)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-neutral-400 pt-1 text-sm font-bold text-ink">
              <span>TOTAL</span>
              <span>{money(total)}</span>
            </div>
            <div className="flex justify-between pt-1 text-neutral-700">
              <span>Payment</span>
              <span className="font-semibold">
                {order.payment}{order.payment === 'Paid' ? ` · ${order.method}` : ''}
              </span>
            </div>
          </div>

          <div className="my-4 border-t border-dashed border-neutral-400" />
          <p className="text-center text-[11px] text-neutral-600">
            Thank you for dining with us!
            <br />
            Please come again — Café Ali
          </p>
        </div>

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
          <button onClick={() => window.print()} className="btn-gold flex-1 py-3">
            <IconPrint size={18} /> Print
          </button>
          <button onClick={onClose} className="btn-ghost px-4">
            <IconClose size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

import { canModify } from '../config/permissions.js'

export default function Billing() {
  const { orders, orderTotal, markPaid, user } = useApp()
  const [active, setActive] = useState(null)

  const paidTotal = orders
    .filter((o) => o.payment === 'Paid')
    .reduce((s, o) => s + orderTotal(o.items).total, 0)
  const unpaidTotal = orders
    .filter((o) => o.payment === 'Unpaid')
    .reduce((s, o) => s + orderTotal(o.items).total, 0)

  const handleMarkPaid = (id) => {
    markPaid(id)
    setActive((cur) => (cur && cur.id === id ? { ...cur, payment: 'Paid', method: 'Cash' } : cur))
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
              onClick={() => setActive(o)}
              className="card group p-5 text-left transition hover:border-gold/40 hover:shadow-gold"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/20">
                  <IconReceipt size={20} />
                </span>
                <PaymentBadge status={o.payment} />
              </div>
              <p className="mt-4 font-semibold text-gold">{o.id}</p>
              <p className="text-xs text-cream-dim">
                Table {o.table} · {o.waiter} · {time(o.createdAt)}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-ink-line pt-3">
                <span className="font-serif text-xl font-semibold text-cream">
                  {money(orderTotal(o.items).total)}
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
          onClose={() => setActive(null)}
          onMarkPaid={handleMarkPaid}
          canMarkPaid={user && canModify(user.role, 'billing')}
        />
      )}
    </div>
  )
}
