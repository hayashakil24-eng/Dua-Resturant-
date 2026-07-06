import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, StatCard, PaymentBadge } from '../components/ui.jsx'
import { money, time } from '../utils/format.js'
import { STAFF, TABLES } from '../data/mockData.js'
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
} from '../components/Icons.jsx'

// ============================================================================
// SHARED DASHBOARD COMPONENT PARTS
// ============================================================================

function RevenueByHour({ orders, orderTotal }) {
  const buckets = {}
  orders
    .filter((o) => o.payment === 'Paid')
    .forEach((o) => {
      const h = new Date(o.createdAt).getHours()
      buckets[h] = (buckets[h] || 0) + orderTotal(o.items).total
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
              <p className="text-sm font-semibold text-cream">{money(orderTotal(o.items).total)}</p>
              <div className="mt-1">
                <PaymentBadge status={o.payment} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OnDutyStaff({ attendance }) {
  const present = STAFF.filter((s) => {
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

function AdminDashboard({ stats, orders, orderTotal, attendance }) {
  let cashTotal = 0
  let cardTotal = 0
  
  orders
    .filter((o) => o.payment === 'Paid')
    .forEach((o) => {
      const tot = orderTotal(o.items).total
      if (o.method === 'Cash') {
        cashTotal += tot
      } else if (o.method === 'Card') {
        cardTotal += tot
      }
    })
  
  const grandTotal = cashTotal + cardTotal
  const cashPct = grandTotal > 0 ? (cashTotal / grandTotal) * 100 : 0
  const cardPct = grandTotal > 0 ? (cardTotal / grandTotal) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IconOrders} label="Today's Orders" value={stats.orderCount} sub={`${stats.pending} awaiting payment`} delay={0} />
        <StatCard icon={IconTrend} label="Revenue" value={money(stats.revenue)} sub="Collected today" delay={60} />
        <StatCard icon={IconTable} label="Active Tables" value={stats.activeTables} sub="Currently dining" delay={120} />
        <StatCard icon={IconUsers} label="Staff Present" value={`${stats.present}/${stats.totalStaff}`} sub="On duty now" delay={180} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Column */}
        <div className="space-y-6 lg:col-span-2">
          <RevenueByHour orders={orders} orderTotal={orderTotal} />
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
          <OnDutyStaff attendance={attendance} />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 2. MANAGER DASHBOARD VIEW
// ============================================================================

function ManagerDashboard({ stats, orders, orderTotal, attendance, unpaidTotal }) {
  return (
    <div className="space-y-6">
      {/* Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IconOrders} label="Today's Orders" value={stats.orderCount} sub={`${stats.pending} awaiting payment`} delay={0} />
        <StatCard icon={IconTable} label="Active Tables" value={stats.activeTables} sub="Currently dining" delay={60} />
        <StatCard icon={IconUsers} label="Staff Present" value={`${stats.present}/${stats.totalStaff}`} sub="On duty now" delay={120} />
        <StatCard icon={IconCash} label="Outstanding" value={money(unpaidTotal)} sub={`${stats.pending} unpaid orders`} delay={180} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Column */}
        <div className="space-y-6 lg:col-span-2">
          <FloorMap orders={orders} orderTotal={orderTotal} />
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
        {TABLES.map((t) => {
          const activeOrder = orders.find((o) => o.table === t.id && o.payment === 'Unpaid')
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
                        {money(orderTotal(activeOrder.items).total)}
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
  const unpaidOrders = orders.filter((o) => o.payment === 'Unpaid')
  const paidOrders = orders.filter((o) => o.payment === 'Paid')

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
                      <p className="text-sm font-semibold text-emerald-300">{money(orderTotal(o.items).total)}</p>
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
  const unpaidOrders = orders.filter((o) => o.payment === 'Unpaid')

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
                  <p className="text-sm font-semibold text-cream">{money(orderTotal(o.items).total)}</p>
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
  const { stats, orders, orderTotal, attendance, user, markPaid } = useApp()
  const [activeReceipt, setActiveReceipt] = useState(null)
  
  const role = user.role

  const unpaidTotal = orders
    .filter((o) => o.payment === 'Unpaid')
    .reduce((s, o) => s + orderTotal(o.items).total, 0)

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
        />
      )}
      {role === 'Manager' && (
        <ManagerDashboard
          stats={stats}
          orders={orders}
          orderTotal={orderTotal}
          attendance={attendance}
          unpaidTotal={unpaidTotal}
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
