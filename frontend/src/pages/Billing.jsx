import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, PaymentBadge, EmptyState } from '../components/ui.jsx'
import { money, time, dateLong, formatQty } from '../utils/format.js'
import { printReceiptRaw } from '../utils/print.js'
import { buildReceiptEscPos } from '../utils/escpos.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { tableLabel, SPECIAL_TABLE_IDS } from '../data/mockData.js'
import DiscountModal from '../components/DiscountModal.jsx'
import ComplimentaryOrderDetail from '../components/ComplimentaryOrderDetail.jsx'
import { complimentaryCost, formatCostTotal } from '../utils/cost.js'
import Logo from '../components/Logo.jsx'
import { IconReceipt, IconPrint, IconCheck, IconClose, IconWallet, IconSearch } from '../components/Icons.jsx'
import { paidAgainstCharge } from '../utils/receivableAllocation.js'

// Same set (and order) as Orders.jsx's FILTERS — the two pages list the same
// orders, so a cashier who learns one toolbar knows the other.
const FILTERS = ['All', 'Paid', 'Unpaid', 'Udhaar', 'Complimentary', 'Cancelled']
const BILLING_PAGE_SIZE = 20

export function Receipt({
  order,
  orderTotal,
  onClose,
  onMarkPaid,
  canMarkPaid = true,
  canDiscount = false,
  onApplyDiscount = () => {},
  onRemoveDiscount = () => {},
  autoPrint = false,
}) {
  const { gstRate, gstEnabled, receivables, menu, user } = useApp()
  // Order items don't carry their own unit — only the menu item they were
  // sold from does.
  const unitOf = (menuItemId) => menu.find((m) => m.id === menuItemId)?.unit || 'pcs'
  // A placed order shows its LOCKED rate; a legacy order without a snapshot (or a
  // brand-new object) falls back to the current global setting.
  const rate = typeof order.gstRate === 'number' ? order.gstRate : gstEnabled ? gstRate : 0
  const { subtotal, tax, discount, total } = orderTotal(order.items, order.discount?.amount, rate)
  // Udhaar orders show how much of THIS order has been recovered — see
  // paidAgainstCharge for why that's derived rather than stored directly.
  const receivable =
    order.payment === 'Udhaar'
      ? receivables.find((r) => (r.charges || []).some((c) => c.orderId === order.serverId))
      : null
  const { paid: udhaarPaid, remaining: udhaarRemaining } = receivable
    ? paidAgainstCharge(receivable, order.serverId)
    : { paid: 0, remaining: 0 }
  const isDelivery = order.table === SPECIAL_TABLE_IDS.delivery
  const [printing, setPrinting] = useState(false)
  useEscapeKey(onClose)

  // Guarded print — ignores rapid repeat clicks so the bill prints once.
  // Raw ESC/POS (see print.js/escpos.js) rather than the old HTML/CSS silent
  // print: Chromium's print pipeline fails outright against real thermal
  // printer drivers on this Electron version (confirmed against both the
  // client's BC-98AC and an unrelated EPSON L3150 — see
  // PRINTER_ISSUE_HANDOFF.md), so the bill never reached the printer at all.
  const handlePrint = () => {
    const buildBytes = () =>
      buildReceiptEscPos({
        order,
        rate,
        subtotal,
        tax,
        discount,
        total,
        unitOf,
        tableLabelText: tableLabel(order.table),
        isDelivery,
        udhaarPaid,
        udhaarRemaining,
        // Deliberately 'en-PK' (not format.js's time()/locale-aware date),
        // so the raw bill always prints Latin digits regardless of the
        // app's current language — see escpos.js's fmtMoney comment for why.
        dateLabel: new Date(order.createdAt).toLocaleDateString('en-PK'),
        timeLabel: new Date(order.createdAt).toLocaleTimeString('en-PK', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
      })
    if (printReceiptRaw(buildBytes)) {
      setPrinting(true)
      setTimeout(() => setPrinting(false), 1500)
    }
  }

  // POS's "Pay Now" flow opens this modal right after a fresh payment and
  // wants the bill to print immediately (after the KOT — see POS.jsx's
  // confirmPayment), without the cashier needing to click Print by hand.
  // Guarded to fire at most once per mount (empty deps + ref, not just the
  // `autoPrint` value) so re-renders from unrelated state changes elsewhere
  // in the app can never trigger a second print of the same receipt.
  const autoPrintFiredRef = useRef(false)
  useEffect(() => {
    if (autoPrint && !autoPrintFiredRef.current) {
      autoPrintFiredRef.current = true
      handlePrint()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm no-print" onClick={onClose} />
      {/* Flex column capped at the viewport so the sticky footer buttons stay
          in view on short screens; the slip scrolls instead of pushing them off. */}
      {/* A complimentary order carries a costing panel alongside the slip, so the
          dialog widens and goes two-column on desktop. Kept at slip width
          otherwise: stacking the panel under a print-width slip pushes it past
          the fold on a laptop, where it cannot be scrolled into view. */}
      <div
        className={`relative z-10 flex max-h-[90vh] w-full flex-col ${
          order.complimentary ? 'max-w-4xl' : 'max-w-sm'
        }`}
      >
        {/* Scrollable content — min-h-0 lets it shrink below the slip height so
            overflow-y-auto actually kicks in inside the flex column. */}
        <div className="min-h-0 overflow-y-auto">
          <div className={order.complimentary ? 'flex flex-col gap-4 lg:flex-row lg:items-start' : ''}>
          {/* Printable slip — deliberately plain/bordered (client reference:
              a real ESC/POS thermal receipt photo, ruled black lines, boxed
              order number, ALL-CAPS section labels), not a soft "web card"
              look. Every border/rule below is solid black by design, not a
              light theme color needing a print-time override. */}
          <div
            id="printable-receipt"
            className="w-full shrink-0 bg-white text-black shadow-lift border border-black lg:w-[384px]"
            style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
          >
            <div className="border-b-2 border-black px-4 py-3 text-center">
              <img
                src="/Cafe Ali Logo -final.png"
                alt="Cafe Ali"
                className="mx-auto h-16 w-16 shrink-0 rounded-full object-contain"
              />
              <p className="mt-1.5 text-lg font-extrabold tracking-wide">CAFE ALI</p>
              <p className="mt-0.5 text-[11px]">Main Hawksbay Beach, Zulfiqar Chowrangi, Maripur Road, Karachi</p>
              <p className="text-[11px]">0313-2870111</p>
            </div>

            <p className="border-b-2 border-black py-2 text-center text-base font-extrabold tracking-wide">
              SALE RECEIPT
            </p>

            {/* Boxed order number — the one thing a customer/kitchen glances at
                first, same as the reference's boxed "47". Derived from the
                existing order id, nothing invented. */}
            <div className="mx-4 mt-3 border-2 border-black py-2 text-center">
              <p className="text-2xl font-extrabold tracking-wide">
                Order # {(order.id.match(/\d+/) || [order.id])[0]}
              </p>
            </div>

            <div className="space-y-1 px-4 py-3 text-[11px]">
              <div className="flex justify-between">
                <span className="font-bold">Date :</span>
                <span>{new Date(order.createdAt).toLocaleDateString('en-PK')}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold">Time :</span>
                <span>{time(order.createdAt)}</span>
              </div>
              {isDelivery ? (
                <>
                  <div className="flex justify-between">
                    <span className="font-bold">Rider :</span>
                    <span>{order.deliveryRiderName || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Customer :</span>
                    <span>{order.deliveryCustomerName || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Phone :</span>
                    <span>{order.deliveryPhone || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="font-bold">Address :</span>
                    <span className="text-right">{order.deliveryAddress || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Delivery Charges :</span>
                    <span>{money(order.deliveryCharge)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="font-bold">Server :</span>
                    <span>{order.waiter || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Table :</span>
                    <span>{tableLabel(order.table)}</span>
                  </div>
                </>
              )}
            </div>

            <table className="w-full border-y-2 border-black text-[11px]">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="py-1.5 pl-4 font-bold">Qty</th>
                  <th className="py-1.5 font-bold">Item</th>
                  <th className="py-1.5 text-right font-bold">Rate</th>
                  <th className="py-1.5 pr-4 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id} className={`align-top ${it.cancelled ? 'line-through opacity-50' : ''}`}>
                    <td className="py-1 pl-4 whitespace-nowrap">{formatQty(it.qty, unitOf(it.menuItemId))}</td>
                    {/* break-words + min-w-0 let a long, unbroken item name wrap
                        onto extra lines within its own column instead of ever
                        pushing the Amount column past the paper's edge —
                        Rate/Amount stay nowrap so they're never the ones that wrap. */}
                    <td className="py-1 pr-2 min-w-0 break-words">
                      {it.name}
                      {/* A struck-through line still needs to say WHY it doesn't
                          count toward the total — otherwise the printed bill
                          looks like a math error, not a cancelled item. */}
                      {it.cancelled && (
                        <div className="text-[9px] font-normal not-italic">Cancelled by {it.cancellation?.by || '—'}</div>
                      )}
                    </td>
                    <td className="py-1 text-right whitespace-nowrap">{money(Math.round(it.price))}</td>
                    <td className="py-1 pr-4 text-right font-bold whitespace-nowrap">{money(Math.round(it.price * it.qty))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1 px-4 py-3 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal :</span>
                <span className="font-bold">{money(subtotal)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between">
                  <span>GST ({Math.round(rate * 100)}%) :</span>
                  <span className="font-bold">{money(tax)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between">
                  {/* Percent first when the discount was given as one — the
                      customer's question is "kitne percent", not the reason. */}
                  <span>
                    Discount
                    {order.discount?.percent ? ` ${order.discount.percent}%` : ''}
                    {order.discount?.reason ? ` (${order.discount.reason})` : ''} :
                  </span>
                  <span className="font-bold">- {money(discount)}</span>
                </div>
              )}
            </div>

            {/* The one figure a customer actually looks for — stronger
                typography (size + weight + its own ruled box) than every other
                row, not a decorative color, so it stays this prominent on
                monochrome thermal paper too. */}
            <div className="flex justify-between border-y-2 border-black px-4 py-2.5 text-base font-extrabold tracking-wide">
              <span>NET BILL :</span>
              <span>{money(total)}</span>
            </div>

            <div className="space-y-1 px-4 py-3 text-[11px]">
              {order.complimentary && (
                <div className="mb-1 border border-black py-1.5 text-center">
                  <p className="font-bold tracking-wide">🎁 COMPLIMENTARY</p>
                  <p className="text-[10px]">
                    By {order.complimentary.orderedBy}
                    {order.complimentary.reason ? ` · ${order.complimentary.reason}` : ''}
                  </p>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-bold">Payment Mode :</span>
                <span>
                  {order.payment === 'Paid' && order.method === 'Online' && order.onlineAccountName
                    ? `Online · ${order.onlineAccountName}`
                    : order.payment === 'Paid'
                      ? order.method
                      : order.payment}
                </span>
              </div>
              {order.payment === 'Paid' && (
                <div className="flex justify-between">
                  <span className="font-bold">Cash Received :</span>
                  <span>{money(total)}</span>
                </div>
              )}
              {/* Udhaar recovered so far against THIS order (derived — see
                  paidAgainstCharge), and what's still owed on it. */}
              {order.payment === 'Udhaar' && udhaarPaid > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Recovered :</span>
                    <span className="font-bold">- {money(udhaarPaid)}</span>
                  </div>
                  <div className="flex justify-between border-t-2 border-black pt-1 font-extrabold">
                    <span>Balance Due :</span>
                    <span>{money(udhaarRemaining)}</span>
                  </div>
                </>
              )}
              {/* Which online account the money landed in — printed for the
                  customer and for daily reconciliation of each account. */}
              {order.method === 'Online' && order.onlineAccountName && (
                <div className="flex justify-between gap-3">
                  <span className="font-bold">Account :</span>
                  <span className="text-right">
                    {[order.onlineAccountName, order.onlineAccountBank, order.onlineAccountType]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              )}
            </div>

            <div className="border-t-2 border-black px-4 py-3 text-center text-[11px]">
              <p className="font-bold tracking-wide">HBL Account: PK52HABB0004817900820103</p>
              <p className="mt-1.5 font-bold tracking-wide">!!!! THANK YOU FOR DINING WITH US !!!!</p>
              <p className="mt-0.5">Please visit again</p>
              {/* Software credit — subtle by size alone (not a faded color,
                  which a thermal printer would dither into near-invisibility
                  anyway), so it never competes with Cafe Ali's own branding. */}
              <p className="mt-2.5 text-[9px] tracking-wide">Powered by Softdap</p>
            </div>
          </div>

          {/* Internal costing for a giveaway — staff-facing only. Sits outside
              the printable slip and is no-print so a customer's receipt never
              shows what the cafe pays for their food. */}
          {order.complimentary && (
            <div className="no-print lg:min-w-0 lg:flex-1">
              <ComplimentaryOrderDetail order={order} />
            </div>
          )}
          </div>
        </div>

        {/* Sticky footer — flex-shrink-0 keeps these controls in view even when
            the slip above scrolls, so they never get clipped on short screens.
            Capped at slip width so the wide complimentary layout doesn't
            stretch Print across the whole dialog. */}
        <div className="w-full flex-shrink-0 lg:max-w-sm">
          {/* Discount controls (Admin/Manager, unpaid orders only) */}
          {canDiscount && order.payment === 'Unpaid' && !order.cancelled && (
            <div className="mt-4 no-print">
              {order.discount ? (
                <div className="flex items-center justify-between rounded-xl border border-ink-line bg-ink-soft px-4 py-2.5">
                  <span className="text-xs text-cream-dim">
                    Discount {order.discount.percent ? `${order.discount.percent}% · ` : ''}
                    {money(order.discount.amount)} · by {order.discount.by}
                  </span>
                  {/* Separation of duties: a Cashier can undo their own discount
                      entry but not override one an Admin/Manager applied — same
                      rule the server re-enforces (orders.service.ts's
                      removeDiscount), so hiding this isn't the only thing
                      stopping it, just keeps a Cashier from seeing a dead end. */}
                  {(user?.role !== 'Cashier' || order.discount.role === 'Cashier') && (
                    <button
                      onClick={() => onRemoveDiscount(order.id)}
                      className="text-xs font-semibold text-rose-300 hover:underline"
                    >
                      Remove
                    </button>
                  )}
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
                title="Mark this order as paid (Cash / Card / Online)"
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 py-3 text-sm font-semibold text-white transition-all duration-200 hover:from-emerald-400 hover:to-green-500 hover:shadow-lg hover:shadow-emerald-500/40 active:scale-95"
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
  const { orders, orderTotal, markPaid, applyDiscount, removeDiscount, user, menu, gstEnabled, gstRate, maxCashierDiscountPercent } = useApp()
  // Track by id so the open receipt reflects live discount / paid changes.
  const [activeId, setActiveId] = useState(null)
  const [showDiscount, setShowDiscount] = useState(false)
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(BILLING_PAGE_SIZE)
  const active = activeId ? orders.find((o) => o.id === activeId) : null

  const canDiscount = Boolean(user && canModify(user.role, 'discount'))

  // Search is order-number only here (Orders.jsx also matches waiter/table) —
  // on the billing counter you're holding a printed slip and typing its number.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orders.filter((o) => {
      const matchFilter =
        filter === 'All' ? true : filter === 'Cancelled' ? o.cancelled : o.payment === filter && !o.cancelled
      return matchFilter && (!q || o.id.toLowerCase().includes(q))
    })
  }, [orders, filter, query])

  const filterCount = (f) => {
    if (f === 'All') return orders.length
    if (f === 'Cancelled') return orders.filter((o) => o.cancelled).length
    return orders.filter((o) => o.payment === f && !o.cancelled).length
  }

  const shownRows = rows.slice(0, visibleCount)

  // The four stat cards below stay deliberately unfiltered — they are the day's
  // running totals (what the drawer should hold), so narrowing to one status
  // must not change them.
  const paidTotal = orders
    .filter((o) => o.payment === 'Paid' && !o.cancelled)
    .reduce((s, o) => s + orderTotal(o.items, o.discount?.amount, o.gstRate).total, 0)
  const unpaidTotal = orders
    .filter((o) => o.payment === 'Unpaid' && !o.cancelled)
    .reduce((s, o) => s + orderTotal(o.items, o.discount?.amount, o.gstRate).total, 0)

  // Complimentary roll-up. The headline number is COGS, not the bill: what the
  // giveaways actually cost the cafe is the ingredient spend.
  const compOrders = orders.filter((o) => o.payment === 'Complimentary' && !o.cancelled)
  const comp = compOrders.reduce(
    (acc, o) => {
      const c = complimentaryCost(o, menu, orderTotal)
      return {
        bill: acc.bill + c.billTotal,
        cost: acc.cost + c.costTotal,
        allKnown: acc.allKnown && c.allKnown,
      }
    },
    { bill: 0, cost: 0, allKnown: true },
  )

  // Returns the mutator's promise (not awaited/closed here) — DiscountModal
  // itself awaits it and only calls onClose (setShowDiscount(false)) on
  // success, so a server-side rejection (Cashier cap, cancelled order, ...)
  // surfaces inside the modal instead of it silently closing as if the
  // discount had applied.
  const handleApplyDiscount = (data) => {
    if (!activeId) return
    return applyDiscount(activeId, data)
  }

  return (
    <div>
      <PageHeader title="Billing & Receipts" subtitle="Generate and print receipts for any order.">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream-dim">
            <IconSearch size={16} />
          </span>
          <input
            className="input py-2 pl-9 sm:w-64"
            placeholder="Search order no."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setVisibleCount(BILLING_PAGE_SIZE)
            }}
          />
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

        {/* Complimentary — headline is estimated COGS, with the forgone bill
            kept as context underneath so the two are never confused. */}
        <div className="rounded-lg border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-amber-900">Complimentary (est. cost)</p>
              <p className="mt-1 text-2xl font-bold text-amber-900">
                {formatCostTotal({ costTotal: comp.cost, allKnown: comp.allKnown }, money)}
              </p>
              <p className="mt-1 text-xs text-amber-700">
                {compOrders.length} order{compOrders.length === 1 ? '' : 's'} · Bill forgone:{' '}
                {money(comp.bill)}
              </p>
            </div>
            <span className="text-4xl">🎁</span>
          </div>
          <div className="mt-2 rounded bg-white p-2 text-xs text-amber-700">
            Accounting books the <strong>cost</strong>, not the bill — the rest is unearned margin.
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f)
              setVisibleCount(BILLING_PAGE_SIZE)
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

      {orders.length === 0 ? (
        <EmptyState icon={IconReceipt} title="No receipts yet" hint="Placed orders will appear here for billing." />
      ) : rows.length === 0 ? (
        <EmptyState icon={IconReceipt} title="No receipts found" hint="Try a different filter or order number." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shownRows.map((o) => (
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
                {tableLabel(o.table)} · {o.waiter || '—'} · {time(o.createdAt)}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-ink-line pt-3">
                <span className="font-serif text-xl font-semibold text-cream">
                  {money(orderTotal(o.items, o.discount?.amount, o.gstRate).total)}
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

      {shownRows.length < rows.length && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setVisibleCount((c) => c + BILLING_PAGE_SIZE)}
            className="btn-ghost px-5 py-2 text-sm"
          >
            Load more · {shownRows.length}/{rows.length}
          </button>
        </div>
      )}

      {active && (
        <Receipt
          order={active}
          orderTotal={orderTotal}
          onClose={() => setActiveId(null)}
          onMarkPaid={(id) => markPaid(id)}
          // Admin oversees billing but doesn't personally settle bills (same
          // rule as Orders.jsx) — that's left to Cashier/Manager.
          canMarkPaid={user && user.role !== 'Admin' && canModify(user.role, 'billing') && !active.cancelled}
          canDiscount={canDiscount}
          onApplyDiscount={() => setShowDiscount(true)}
          onRemoveDiscount={(id) => removeDiscount(id)}
        />
      )}

      {showDiscount && active && (
        <DiscountModal
          order={active}
          // Pre-discount breakdown: GST is part of the base a percentage applies to.
          bill={orderTotal(active.items, 0, active.gstRate)}
          rate={typeof active.gstRate === 'number' ? active.gstRate : gstEnabled ? gstRate : 0}
          // null = unlimited (Admin/Manager, 'full'); Cashier ('edit'/capped)
          // gets the Admin-set ceiling — re-enforced server-side regardless.
          maxPercent={user?.role === 'Cashier' ? maxCashierDiscountPercent : null}
          onApply={handleApplyDiscount}
          onClose={() => setShowDiscount(false)}
        />
      )}
    </div>
  )
}
