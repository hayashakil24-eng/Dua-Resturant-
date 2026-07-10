import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, StatCard, PaymentBadge } from '../components/ui.jsx'
import { money, time } from '../utils/format.js'
import { payrollTotal } from '../utils/payroll.js'
import { Receipt } from './Billing.jsx'
import { canModify } from '../config/permissions.js'
import {
  IconOrders,
  IconTrend,
  IconTable,
  IconUsers,
  IconPOS,
  IconCash,
  IconReceipt,
  IconAlert,
  IconInventory,
  IconWallet,
} from '../components/Icons.jsx'

// ============================================================================
// LIVE CLOCK + AUTO-REFRESH  (header)
// ============================================================================

// Auto-updating clock (1s) with a "Live" pulse. The 5s auto-refresh handler is
// passed in so the same widget shows when data was last synced.
function LiveClock({ lastRefresh, onRefresh }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const clock = now.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
  const day = now.toLocaleDateString('en-PK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const ago = Math.max(0, Math.round((now - lastRefresh) / 1000))

  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-soft px-4 py-2">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <div className="leading-tight">
        <p className="font-serif text-sm font-semibold tabular-nums text-cream">{clock}</p>
        <p className="text-[10px] text-cream-dim">{day} · synced {ago}s ago</p>
      </div>
      <button
        onClick={onRefresh}
        title="Refresh now"
        className="ml-1 text-xs font-semibold text-gold hover:underline"
      >
        Refresh
      </button>
    </div>
  )
}

// ============================================================================
// LOW STOCK ALERT
// ============================================================================

function LowStockAlert({ items }) {
  if (!items.length) return null

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30">
            <IconAlert size={20} />
          </span>
          <div>
            <h3 className="font-serif text-lg text-cream">Low Stock Alert</h3>
            <p className="text-xs text-cream-dim">
              {items.length} item{items.length > 1 ? 's' : ''} need restocking soon.
            </p>
          </div>
        </div>
        <Link
          to="/inventory"
          className="hidden items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 sm:inline-flex"
        >
          <IconInventory size={14} /> View Inventory
        </Link>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((it) => {
          const critical = it.stock <= it.threshold * 0.5
          return (
            <div
              key={it.id}
              className="flex items-center justify-between rounded-xl border border-ink-line bg-ink-soft/60 px-3 py-2"
            >
              <span className="text-sm font-medium text-cream">{it.name}</span>
              <span
                className={`text-xs font-semibold ${critical ? 'text-rose-300' : 'text-amber-300'}`}
              >
                {it.stock} {it.unit} left
              </span>
            </div>
          )
        })}
      </div>
      <Link
        to="/inventory"
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200 hover:underline sm:hidden"
      >
        <IconInventory size={14} /> View Inventory →
      </Link>
    </div>
  )
}

// ============================================================================
// CASH DRAWER RECONCILIATION  (Admin / Manager)
// ============================================================================

const SHIFT_META = {
  matched: { label: '✓ Matched', chip: 'bg-emerald-600 text-white', border: 'border-emerald-500/40 bg-emerald-500/[0.06]', diff: 'text-emerald-300' },
  shortage: { label: 'Shortage', chip: 'bg-rose-600 text-white', border: 'border-rose-500/40 bg-rose-500/[0.06]', diff: 'text-rose-300' },
  excess: { label: 'Excess', chip: 'bg-sky-600 text-white', border: 'border-sky-500/40 bg-sky-500/[0.06]', diff: 'text-sky-300' },
  active: { label: '⏳ Active', chip: 'bg-gold/20 text-gold', border: 'border-ink-line bg-ink-soft/50', diff: 'text-cream-dim' },
}

function CashReconciliation() {
  const { shiftReconciliations, calculateShiftSales } = useApp()

  const todayShifts = shiftReconciliations.filter(
    (s) => new Date(s.shiftStartTime).toDateString() === new Date().toDateString(),
  )
  const shortages = todayShifts.filter((s) => s.status === 'shortage')

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between border-b border-ink-line pb-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
            <IconCash size={20} />
          </span>
          <div>
            <h3 className="font-serif text-xl text-cream">Cash Reconciliation</h3>
            <p className="text-xs text-cream-dim">Shift drawer counts · today</p>
          </div>
        </div>
        {shortages.length > 0 && (
          <span className="badge bg-rose-500/12 text-rose-300 ring-1 ring-rose-500/30">
            {shortages.length} shortage{shortages.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {shortages.length > 0 && (
        <div className="mt-4 rounded-xl border-l-4 border-rose-500 bg-rose-500/[0.08] px-4 py-3 text-sm font-semibold text-rose-300">
          ⚠️ {shortages.length} shift{shortages.length > 1 ? 's' : ''} closed with a cash shortage — review below.
        </div>
      )}

      {todayShifts.length === 0 ? (
        <p className="mt-6 text-sm text-cream-dim">No shifts recorded today.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {todayShifts.map((s) => {
            const meta = SHIFT_META[s.status] || SHIFT_META.active
            const live = s.status === 'active' ? calculateShiftSales(s.id) : null
            return (
              <div key={s.id} className={`rounded-xl border p-4 ${meta.border}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-cream">{s.cashierName}</p>
                    <p className="text-xs text-cream-dim">
                      {time(s.shiftStartTime)} – {s.shiftEndTime ? time(s.shiftEndTime) : 'now'}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold ${meta.chip}`}>
                    {meta.label}
                  </span>
                </div>

                {s.status === 'active' ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-[11px] text-cream-dim">Opening</p>
                      <p className="font-semibold text-cream">{money(s.openingCash)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-cream-dim">Expected so far</p>
                      <p className="font-semibold text-gold">{money(live?.expectedCash ?? s.openingCash)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-[11px] text-cream-dim">Expected</p>
                      <p className="font-semibold text-cream">{money(s.expectedCash)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-cream-dim">Actual</p>
                      <p className="font-semibold text-cream">{money(s.actualCash)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-cream-dim">Difference</p>
                      <p className={`font-semibold ${meta.diff}`}>
                        {s.status === 'matched' ? money(0) : money(Math.abs(s.difference))}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SHARED DASHBOARD COMPONENT PARTS
// ============================================================================

function RevenueByHour({ orders, orderTotal }) {
  const buckets = {}
  orders
    .filter((o) => o.payment === 'Paid' && !o.cancelled)
    .forEach((o) => {
      const h = new Date(o.createdAt).getHours()
      buckets[h] = (buckets[h] || 0) + orderTotal(o.items, o.discount?.amount).total
    })
  const hours = Object.keys(buckets).map(Number).sort((a, b) => a - b)
  const max = Math.max(1, ...Object.values(buckets))

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl text-cream">Revenue by hour</h3>
        <span className="text-xs text-cream-dim">Paid orders · today</span>
      </div>
      {hours.length === 0 ? (
        <p className="mt-8 text-sm text-cream-dim">No paid revenue yet.</p>
      ) : (
        <div className="mt-8 flex h-44 items-end gap-3">
          {hours.map((h) => {
            const pct = (buckets[h] / max) * 100
            const label = `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`
            return (
              <div key={h} className="group flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] font-medium text-gold opacity-0 transition group-hover:opacity-100">
                  {money(buckets[h])}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-lg bg-gold-grad transition-all duration-500 group-hover:brightness-110"
                    style={{ height: `${Math.max(6, pct)}%` }}
                  />
                </div>
                <span className="text-[10px] text-cream-dim">{label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RecentOrders({ orders, orderTotal }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-line p-5">
        <h3 className="font-serif text-xl text-cream">Recent orders</h3>
        <Link to="/orders" className="text-xs font-semibold text-gold hover:underline">
          View all →
        </Link>
      </div>
      <div className="divide-y divide-ink-line">
        {orders.slice(0, 5).map((o) => (
          <div key={o.id} className="flex items-center gap-4 p-4 hover:bg-white/[0.02]">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/10 font-serif text-sm font-semibold text-gold ring-1 ring-gold/20">
              T{o.table}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-cream">
                {o.id} · <span className="text-cream-dim">{o.waiter}</span>
              </p>
              <p className="truncate text-xs text-cream-dim">
                {o.items.reduce((s, i) => s + i.qty, 0)} items · {time(o.createdAt)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-cream">{money(orderTotal(o.items, o.discount?.amount).total)}</p>
              <div className="mt-1">
                {o.cancelled ? (
                  <span className="badge bg-rose-500/12 text-rose-300 ring-1 ring-rose-500/30">Cancelled</span>
                ) : (
                  <PaymentBadge status={o.payment} />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OnDutyStaff({ attendance }) {
  const { staff } = useApp()
  const present = staff.filter((s) => {
    if (s.active === false) return false
    const a = attendance[s.id]
    return a && (a.status === 'Present' || a.status === 'Late')
  })
  return (
    <div className="card h-fit p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl text-cream">On duty</h3>
        <span className="badge bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/30">
          {present.length} present
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {present.map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-xs font-semibold text-cream ring-1 ring-ink-line">
              {s.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-cream">{s.name}</p>
              <p className="text-xs text-cream-dim">{s.role} · {s.shift}</p>
            </div>
            <span className="text-xs text-emerald-300">{time(attendance[s.id].checkIn)}</span>
          </div>
        ))}
      </div>
      <Link to="/attendance" className="btn-ghost mt-6 w-full text-sm">
        Manage attendance
      </Link>
    </div>
  )
}

// ============================================================================
// 1. ADMIN DASHBOARD VIEW
// ============================================================================

function AdminDashboard({ stats, orders, orderTotal, attendance, lowStock }) {
  const { staff } = useApp()
  let cashTotal = 0
  let cardTotal = 0
  
  orders
    .filter((o) => o.payment === 'Paid' && !o.cancelled)
    .forEach((o) => {
      const tot = orderTotal(o.items, o.discount?.amount).total
      if (o.method === 'Cash') {
        cashTotal += tot
      } else if (o.method === 'Card') {
        cardTotal += tot
      }
    })
  
  const grandTotal = cashTotal + cardTotal
  const cashPct = grandTotal > 0 ? (cashTotal / grandTotal) * 100 : 0
  const cardPct = grandTotal > 0 ? (cardTotal / grandTotal) * 100 : 0

  // Estimated payroll for the current month (before ad-hoc deductions).
  const now = new Date()
  const monthlyPayroll = payrollTotal(now.getFullYear(), now.getMonth(), now, staff)
  const activeStaffCount = staff.filter((s) => s.active !== false).length
  const monthName = now.toLocaleDateString('en-PK', { month: 'long' })

  return (
    <div className="space-y-6">
      {/* Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IconOrders} label="Today's Orders" value={stats.orderCount} sub={`${stats.pending} awaiting payment`} delay={0} />
        <StatCard icon={IconTrend} label="Revenue" value={money(stats.revenue)} sub="Collected today" delay={60} />
        <StatCard icon={IconTable} label="Active Tables" value={stats.activeTables} sub="Currently dining" delay={120} />
        <StatCard icon={IconUsers} label="Staff Present" value={`${stats.present}/${stats.totalStaff}`} sub="On duty now" delay={180} />
      </div>

      <LowStockAlert items={lowStock} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Column */}
        <div className="space-y-6 lg:col-span-2">
          <RevenueByHour orders={orders} orderTotal={orderTotal} />
          <CashReconciliation />
          <RecentOrders orders={orders} orderTotal={orderTotal} />
        </div>

        {/* Side Column */}
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-serif text-xl text-cream">Payment Methods</h3>
              <span className="text-xs text-cream-dim font-medium">Breakdown</span>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-cream-dim">Cash Payments</span>
                  <span className="font-semibold text-cream">{money(cashTotal)} ({Math.round(cashPct)}%)</span>
                </div>
                <div className="w-full h-2 bg-ink-line rounded-full overflow-hidden">
                  <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${cashPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-cream-dim">Card Payments</span>
                  <span className="font-semibold text-cream">{money(cardTotal)} ({Math.round(cardPct)}%)</span>
                </div>
                <div className="w-full h-2 bg-ink-line rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${cardPct}%` }} />
                </div>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-ink-line flex justify-between items-center text-xs text-cream-dim">
              <span>Total collected</span>
              <span className="font-serif font-bold text-sm text-gold">{money(grandTotal)}</span>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
                <IconWallet size={20} />
              </span>
              <div>
                <h3 className="font-serif text-xl text-cream">Monthly Payroll</h3>
                <p className="text-xs text-cream-dim">{monthName} · estimated</p>
              </div>
            </div>
            <p className="mt-4 font-serif text-3xl font-semibold text-gold">{money(monthlyPayroll)}</p>
            <p className="mt-1 text-xs text-cream-dim">
              Across {activeStaffCount} staff · before deductions
            </p>
            <Link
              to="/payroll"
              className="btn-ghost mt-5 w-full text-sm"
            >
              View payroll →
            </Link>
          </div>

          <OnDutyStaff attendance={attendance} />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 2. MANAGER DASHBOARD VIEW
// ============================================================================

function ManagerDashboard({ stats, orders, orderTotal, attendance, unpaidTotal, lowStock }) {
  return (
    <div className="space-y-6">
      {/* Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IconOrders} label="Today's Orders" value={stats.orderCount} sub={`${stats.pending} awaiting payment`} delay={0} />
        <StatCard icon={IconTable} label="Active Tables" value={stats.activeTables} sub="Currently dining" delay={60} />
        <StatCard icon={IconUsers} label="Staff Present" value={`${stats.present}/${stats.totalStaff}`} sub="On duty now" delay={120} />
        <StatCard icon={IconCash} label="Outstanding" value={money(unpaidTotal)} sub={`${stats.pending} unpaid orders`} delay={180} />
      </div>

      <LowStockAlert items={lowStock} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Column */}
        <div className="space-y-6 lg:col-span-2">
          <FloorMap orders={orders} orderTotal={orderTotal} />
          <CashReconciliation />
          <RecentOrders orders={orders} orderTotal={orderTotal} />
        </div>

        {/* Side Column */}
        <div>
          <OnDutyStaff attendance={attendance} />
        </div>
      </div>
    </div>
  )
}

function FloorMap({ orders, orderTotal }) {
  const { tables } = useApp()
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5 border-b border-ink-line pb-4">
        <div>
          <h3 className="font-serif text-xl text-cream">Table Floor Map</h3>
          <p className="text-xs text-cream-dim mt-0.5">Real-time table status and waitstaff assignments.</p>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-cream-dim">
            <span className="h-2.5 w-2.5 rounded bg-ink-line ring-1 ring-white/10" /> Vacant
          </span>
          <span className="flex items-center gap-1.5 text-gold">
            <span className="h-2.5 w-2.5 rounded bg-gold/20 ring-1 ring-gold/50 shadow-sm" /> Occupied
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {tables.map((t) => {
          const activeOrder = orders.find((o) => o.table === t.id && o.payment === 'Unpaid' && !o.cancelled)
          const occupied = !!activeOrder

          return (
            <div
              key={t.id}
              className={`relative rounded-xl border p-4 transition-all duration-300 ${
                occupied
                  ? 'border-gold bg-gold/5 shadow-gold ring-1 ring-gold/25'
                  : 'border-ink-line bg-ink-soft/40 hover:border-gold/30'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="font-serif text-lg font-bold text-cream">T{t.id}</span>
                <span className="text-[9px] text-cream-dim font-bold uppercase bg-white/5 px-2 py-0.5 rounded-md">
                  {t.seats} seats
                </span>
              </div>
              
              <div className="mt-4">
                {occupied ? (
                  <div className="space-y-1">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-gold/75">Waiter</p>
                      <p className="text-xs font-semibold text-cream truncate">{activeOrder.waiter}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-cream-dim">Total Bill</p>
                      <p className="text-xs font-bold text-gold">
                        {money(orderTotal(activeOrder.items, activeOrder.discount?.amount).total)}
                      </p>
                    </div>
                    <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-gold"></span>
                    </span>
                  </div>
                ) : (
                  <div className="py-2.5">
                    <span className="text-xs text-cream-dim/50 italic font-medium">Available</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// 3. CASHIER DASHBOARD VIEW
// ============================================================================

function CashierDashboard({ stats, orders, orderTotal, unpaidTotal, onProcessBill }) {
  const unpaidOrders = orders.filter((o) => o.payment === 'Unpaid' && !o.cancelled)
  const paidOrders = orders.filter((o) => o.payment === 'Paid' && !o.cancelled)

  return (
    <div className="space-y-6">
      {/* Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IconOrders} label="Today's Orders" value={stats.orderCount} sub="Placed today" delay={0} />
        <StatCard icon={IconTrend} label="Collected" value={money(stats.revenue)} sub="Paid revenue" delay={60} />
        <StatCard icon={IconCash} label="Pending" value={stats.pending} sub={`${money(unpaidTotal)} to collect`} delay={120} />
        <StatCard icon={IconReceipt} label="Receipts" value={orders.length} sub="Ready to print" delay={180} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Column */}
        <div className="space-y-6 lg:col-span-2">
          <PendingBillsQueue orders={orders} orderTotal={orderTotal} onProcessBill={onProcessBill} />
          
          {/* Recent Sales History */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-line p-5">
              <h3 className="font-serif text-xl text-cream">Recent Payments Collected</h3>
              <span className="text-xs text-cream-dim font-medium">Paid orders today</span>
            </div>
            {paidOrders.length === 0 ? (
              <div className="p-8 text-center text-sm text-cream-dim">
                No payments collected yet.
              </div>
            ) : (
              <div className="divide-y divide-ink-line">
                {paidOrders.slice(0, 5).map((o) => (
                  <div key={o.id} className="flex items-center gap-4 p-4 hover:bg-white/[0.02]">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 font-serif text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/20">
                      T{o.table}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-cream">
                        {o.id} · <span className="text-cream-dim">{o.waiter}</span>
                      </p>
                      <p className="truncate text-xs text-cream-dim">
                        {o.items.reduce((s, i) => s + i.qty, 0)} items · {time(o.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-300">{money(orderTotal(o.items, o.discount?.amount).total)}</p>
                      <span className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-cream-dim">
                        {o.method}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Side Column */}
        <div className="space-y-6">
          <div className="card h-fit p-6">
            <h3 className="font-serif text-xl text-cream">Cashier Desk Actions</h3>
            <p className="mt-1 text-xs text-cream-dim font-medium">Jump straight to terminal operations.</p>
            <div className="mt-5 space-y-3">
              <Link
                to="/pos"
                className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-soft p-4 transition hover:border-gold/40"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/20">
                  <IconPOS size={20} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-cream">Open POS Terminal</p>
                  <p className="text-xs text-cream-dim">Take new orders & checkout</p>
                </div>
              </Link>
              <Link
                to="/billing"
                className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-soft p-4 transition hover:border-gold/40"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/20">
                  <IconReceipt size={20} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-cream">Print Receipts & Bills</p>
                  <p className="text-xs text-cream-dim">{stats.pending} bills to process</p>
                </div>
              </Link>
            </div>
            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-xs uppercase tracking-widest text-amber-300/80 font-bold">Total outstanding to collect</p>
              <p className="mt-1.5 font-serif text-3xl font-semibold text-amber-300">{money(unpaidTotal)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PendingBillsQueue({ orders, orderTotal, onProcessBill }) {
  const unpaidOrders = orders.filter((o) => o.payment === 'Unpaid' && !o.cancelled)

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-line p-5">
        <h3 className="font-serif text-xl text-cream">Awaiting Payment Queue</h3>
        <span className="badge bg-amber-500/12 text-amber-300 ring-1 ring-amber-500/30">
          {unpaidOrders.length} pending bills
        </span>
      </div>
      {unpaidOrders.length === 0 ? (
        <div className="p-12 text-center text-sm text-cream-dim">
          All bills are paid! No pending payments.
        </div>
      ) : (
        <div className="divide-y divide-ink-line">
          {unpaidOrders.map((o) => (
            <div key={o.id} className="flex flex-col gap-3 p-4 hover:bg-white/[0.01] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-serif font-bold text-gold text-lg">Table {o.table}</span>
                  <span className="text-cream-dim">·</span>
                  <span className="text-sm font-semibold text-cream">{o.id}</span>
                  <span className="text-xs text-cream-dim">({o.waiter})</span>
                </div>
                <p className="mt-1 truncate text-xs text-cream-dim">
                  {o.items.map((it) => `${it.name} x${it.qty}`).join(', ')}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-ink-line/30 pt-2 sm:border-t-0 sm:pt-0">
                <div className="text-right">
                  <p className="text-sm font-semibold text-cream">{money(orderTotal(o.items, o.discount?.amount).total)}</p>
                  <p className="text-[10px] text-cream-dim">{time(o.createdAt)}</p>
                </div>
                <button
                  onClick={() => onProcessBill(o)}
                  className="btn-gold px-3.5 py-1.5 text-xs font-bold shrink-0"
                >
                  Process Bill
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MAIN DASHBOARD ENTRY COMPONENT
// ============================================================================

export default function Dashboard() {
  const { stats, orders, orderTotal, attendance, lowStock, user, markPaid } = useApp()
  const [activeReceipt, setActiveReceipt] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(() => new Date())

  // Auto-refresh every 5s. Data is reactive client state today, so this bumps
  // the "synced" timestamp; swap refreshData() for a real fetch once wired.
  useEffect(() => {
    const refreshData = () => setLastRefresh(new Date())
    const interval = setInterval(refreshData, 5000)
    return () => clearInterval(interval)
  }, [])

  const role = user.role

  const unpaidTotal = orders
    .filter((o) => o.payment === 'Unpaid' && !o.cancelled)
    .reduce((s, o) => s + orderTotal(o.items, o.discount?.amount).total, 0)

  // Role-specific headers and page headings
  const heading = {
    Admin: { title: 'Admin Overview', sub: 'Full picture of financial performance and restaurant state today.' },
    Manager: { title: 'Operations Dashboard', sub: 'Floor tables, waiter workloads, and on-duty staff at a glance.' },
    Cashier: { title: 'Cashier Desk Dashboard', sub: 'Payments checkout, pending bills queue, and receipt generator.' },
  }[role]

  const handleMarkPaid = (id) => {
    markPaid(id)
    setActiveReceipt((cur) => (cur && cur.id === id ? { ...cur, payment: 'Paid', method: 'Cash' } : cur))
  }

  return (
    <div>
      <PageHeader title={`${heading.title} · ${user.name.split(' ')[0]}`} subtitle={heading.sub}>
        <LiveClock lastRefresh={lastRefresh} onRefresh={() => setLastRefresh(new Date())} />
        <Link to="/pos" className="btn-gold">
          <IconPOS size={18} /> New Order
        </Link>
      </PageHeader>

      {/* Render the specific dashboard view based on user role */}
      {role === 'Admin' && (
        <AdminDashboard
          stats={stats}
          orders={orders}
          orderTotal={orderTotal}
          attendance={attendance}
          lowStock={lowStock}
        />
      )}
      {role === 'Manager' && (
        <ManagerDashboard
          stats={stats}
          orders={orders}
          orderTotal={orderTotal}
          attendance={attendance}
          unpaidTotal={unpaidTotal}
          lowStock={lowStock}
        />
      )}
      {role === 'Cashier' && (
        <CashierDashboard
          stats={stats}
          orders={orders}
          orderTotal={orderTotal}
          unpaidTotal={unpaidTotal}
          onProcessBill={(order) => setActiveReceipt(order)}
        />
      )}

      {/* Interactive print / pay dialog on Cashier Desk */}
      {activeReceipt && (
        <Receipt
          order={activeReceipt}
          orderTotal={orderTotal}
          onClose={() => setActiveReceipt(null)}
          onMarkPaid={handleMarkPaid}
          canMarkPaid={user && canModify(user.role, 'billing')}
        />
      )}
    </div>
  )
}
