import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { useT, useLang } from '../i18n/LanguageContext.jsx'
import { itemNameLabel, unitLabel } from '../i18n/dataDict.js'
import { PageHeader, StatCard, PaymentBadge } from '../components/ui.jsx'
import { money, time, dateShort, clock as fmtClock, dayShort, monthName as fmtMonthName } from '../utils/format.js'
import { tableLabel } from '../data/mockData.js'
import HandoverApprovalModal from '../components/HandoverApprovalModal.jsx'
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
  const t = useT()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const clock = fmtClock(now)
  const day = dayShort(now)
  const ago = Math.max(0, Math.round((now - lastRefresh) / 1000))

  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-soft px-4 py-2">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <div className="leading-tight">
        <p className="font-serif text-sm font-semibold tabular-nums text-cream">{clock}</p>
        <p className="text-[10px] text-cream-dim">
          {day} · {t('dashboard.synced')} {ago}s {t('common.ago')}
        </p>
      </div>
      <button
        onClick={onRefresh}
        title={t('dashboard.refresh')}
        className="ms-1 text-xs font-semibold text-gold hover:underline"
      >
        {t('dashboard.refresh')}
      </button>
    </div>
  )
}

// ============================================================================
// LOW STOCK ALERT
// ============================================================================

function LowStockAlert({ items }) {
  const { t, lang } = useLang()
  if (!items.length) return null

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30">
            <IconAlert size={20} />
          </span>
          <div>
            <h3 className="font-serif text-lg text-cream">{t('dashboard.lowStockAlert')}</h3>
            <p className="text-xs text-cream-dim">
              {items.length} {t('dashboard.itemsNeedRestock')}
            </p>
          </div>
        </div>
        <Link
          to="/inventory"
          className="hidden items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20 sm:inline-flex"
        >
          <IconInventory size={14} /> {t('dashboard.viewInventory')}
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
              <span className="text-sm font-medium text-cream">{itemNameLabel(it.name, lang)}</span>
              <span
                className={`text-xs font-semibold ${critical ? 'text-rose-300' : 'text-amber-300'}`}
              >
                {it.stock} {unitLabel(it.unit, lang)} {t('dashboard.left')}
              </span>
            </div>
          )
        })}
      </div>
      <Link
        to="/inventory"
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:underline sm:hidden"
      >
        <IconInventory size={14} /> {t('dashboard.viewInventory')} →
      </Link>
    </div>
  )
}

// ============================================================================
// CASH DRAWER RECONCILIATION  (Admin / Manager)
// ============================================================================

// Chip colors follow the app-wide translucent badge convention (bg-*-500/12
// text-*-300 ring-*-500/30), same formula as PaymentBadge/StatusBadge in
// ui.jsx — this used to be a solid-fill chip, the only one in the app.
const SHIFT_META = {
  matched: { label: '✓ Matched', chip: 'bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/30', border: 'border-emerald-500/40 bg-emerald-500/[0.06]', diff: 'text-emerald-300' },
  shortage: { label: 'Shortage', chip: 'bg-rose-500/12 text-rose-300 ring-1 ring-rose-500/30', border: 'border-rose-500/40 bg-rose-500/[0.06]', diff: 'text-rose-300' },
  excess: { label: 'Excess', chip: 'bg-sky-500/12 text-sky-300 ring-1 ring-sky-500/30', border: 'border-sky-500/40 bg-sky-500/[0.06]', diff: 'text-sky-300' },
  active: { label: '⏳ Active', chip: 'bg-gold/12 text-gold ring-1 ring-gold/30', border: 'border-ink-line bg-ink-soft/50', diff: 'text-cream-dim' },
}

function CashReconciliation() {
  const { shiftReconciliations, calculateShiftSales } = useApp()
  const t = useT()

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
            <h3 className="font-serif text-xl text-cream">{t('dashboard.cashReconciliation')}</h3>
            <p className="text-xs text-cream-dim">{t('dashboard.shiftDrawerToday')}</p>
          </div>
        </div>
        {shortages.length > 0 && (
          <span className="badge bg-rose-500/12 text-rose-300 ring-1 ring-rose-500/30">
            {shortages.length} {t('dashboard.shortagesLabel')}
          </span>
        )}
      </div>

      {shortages.length > 0 && (
        <div className="mt-4 rounded-xl border-s-4 border-rose-500 bg-rose-500/[0.08] px-4 py-3 text-sm font-semibold text-rose-300">
          ⚠️ {shortages.length} {t('dashboard.shiftsShortageWarn')}
        </div>
      )}

      {todayShifts.length === 0 ? (
        <p className="mt-6 text-sm text-cream-dim">{t('dashboard.noShiftsToday')}</p>
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
                    {t(`status.${s.status}`, meta.label)}
                  </span>
                </div>

                {s.status === 'active' ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-[11px] text-cream-dim">{t('dashboard.opening')}</p>
                      <p className="font-semibold text-cream">{money(s.openingCash)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-cream-dim">{t('dashboard.expectedSoFar')}</p>
                      <p className="font-semibold text-gold">{money(live?.expectedCash ?? s.openingCash)}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-[11px] text-cream-dim">{t('dashboard.expected')}</p>
                        <p className="font-semibold text-cream">{money(s.expectedCash)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-cream-dim">{t('dashboard.actual')}</p>
                        <p className="font-semibold text-cream">{money(s.actualCash)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-cream-dim">{t('dashboard.difference')}</p>
                        <p className={`font-semibold ${meta.diff}`}>
                          {s.status === 'matched' ? money(0) : money(Math.abs(s.difference))}
                        </p>
                      </div>
                    </div>
                    {s.handedToName && (
                      <p className="mt-2 border-t border-ink-line pt-2 text-[11px] text-cream-dim">
                        {t('dashboard.handedTo')}: <span className="text-cream">{s.handedToName}</span>
                        {s.handoverReason ? ` · ${s.handoverReason}` : ''}
                      </p>
                    )}
                  </>
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
  const t = useT()
  const buckets = {}
  orders
    .filter((o) => o.payment === 'Paid' && !o.cancelled)
    .forEach((o) => {
      const h = new Date(o.createdAt).getHours()
      buckets[h] = (buckets[h] || 0) + orderTotal(o.items, o.discount?.amount, o.gstRate).total
    })
  const hours = Object.keys(buckets).map(Number).sort((a, b) => a - b)
  const max = Math.max(1, ...Object.values(buckets))

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl text-cream">{t('dashboard.revenueByHour')}</h3>
        <span className="text-xs text-cream-dim">{t('dashboard.paidOrdersToday')}</span>
      </div>
      {hours.length === 0 ? (
        <p className="mt-8 text-sm text-cream-dim">{t('dashboard.noPaidRevenue')}</p>
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
  const t = useT()
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-line p-5">
        <h3 className="font-serif text-xl text-cream">{t('dashboard.recentOrders')}</h3>
        <Link to="/orders" className="text-xs font-semibold text-gold hover:underline">
          {t('common.viewAll')} →
        </Link>
      </div>
      <div className="divide-y divide-ink-line">
        {orders.slice(0, 5).map((o) => (
          <div key={o.id} className="flex items-center gap-4 p-4 hover:bg-white/[0.02]">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/10 font-serif text-xs font-semibold text-gold ring-1 ring-gold/20">
              {tableLabel(o.table)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-cream">
                {o.id} · <span className="text-cream-dim">{o.waiter}</span>
              </p>
              <p className="truncate text-xs text-cream-dim">
                {o.items.reduce((s, i) => s + i.qty, 0)} {t('common.items')} · {time(o.createdAt)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-cream">{money(orderTotal(o.items, o.discount?.amount, o.gstRate).total)}</p>
              <div className="mt-1">
                {o.cancelled ? (
                  <span className="badge bg-rose-500/12 text-rose-300 ring-1 ring-rose-500/30">{t('status.cancelled')}</span>
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
  const t = useT()
  const present = staff.filter((s) => {
    if (s.active === false) return false
    const a = attendance[s.id]
    return a && (a.status === 'Present' || a.status === 'Late')
  })
  return (
    <div className="card h-fit p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl text-cream">{t('dashboard.onDuty')}</h3>
        <span className="badge bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/30">
          {present.length} {t('dashboard.present')}
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
        {t('dashboard.manageAttendance')}
      </Link>
    </div>
  )
}

// ============================================================================
// INGREDIENT REQUESTS PANEL
// ============================================================================

function IngredientRequestsPanel({ role }) {
  const { ingredientRequests, approveIngredientRequest, rejectIngredientRequest } = useApp()
  const t = useT()

  // Local state for approval forms
  const [editingId, setEditingId] = useState(null)
  const [baseUnit, setBaseUnit] = useState('kg')
  const [initialStock, setInitialStock] = useState('0')
  const [threshold, setThreshold] = useState('10')
  const [error, setError] = useState('')
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const pending = ingredientRequests ? ingredientRequests.filter((r) => r.status === 'pending') : []

  if (pending.length === 0) return null

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5 border-b border-ink-line pb-4">
        <div>
          <h3 className="font-serif text-xl text-cream">{t('dashboard.pendingIngredientRequests')}</h3>
          <p className="text-xs text-cream-dim mt-0.5">{t('dashboard.submittedByChefs')}</p>
        </div>
        <span className="badge bg-gold/15 text-gold font-semibold">{pending.length} {t('dashboard.pending')}</span>
      </div>

      <div className="space-y-4">
        {pending.map((req) => (
          <div key={req.id} className="rounded-xl border border-ink-line bg-ink-soft p-4 animate-fade-up">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h4 className="font-semibold text-cream text-base">{req.name}</h4>
                <p className="text-xs text-cream-dim mt-0.5">
                  {t('dashboard.category')}: <span className="text-gold">{req.category}</span> · {t('dashboard.requestedBy')}: {req.requestedBy} · {dateShort(req.requestedAt)}
                </p>
              </div>

              {role === 'Admin' && (
                <div className="flex items-center gap-2">
                  {editingId !== req.id && rejectingId !== req.id && (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(req.id)
                          setRejectingId(null)
                          setError('')
                        }}
                        className="rounded-lg bg-gold-grad px-3.5 py-1.5 text-xs font-bold text-ink transition hover:brightness-110"
                      >
                        {t('common.approve')}
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(req.id)
                          setEditingId(null)
                          setRejectReason('')
                        }}
                        className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-1.5 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20"
                      >
                        {t('common.reject')}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Approval Form (Admin Only) */}
            {editingId === req.id && (
              <div className="mt-4 border-t border-ink-line/50 pt-4">
                <p className="text-xs font-bold text-gold mb-3">{t('dashboard.setupInventoryDetails')}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-cream-dim">{t('dashboard.baseUnit')} *</label>
                    <select
                      className="input py-2 text-xs"
                      value={baseUnit}
                      onChange={(e) => setBaseUnit(e.target.value)}
                    >
                      {/* Base unit = how the item is *stocked* (bulk), so only
                          bulk units here — spoons/cups belong on the recipe, not
                          the inventory record. Matches Inventory.jsx's UNITS. */}
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="L">L</option>
                      <option value="ml">ml</option>
                      <option value="pcs">pcs</option>
                      <option value="packs">packs</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-cream-dim">{t('dashboard.initialStock')} *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input py-2 text-xs"
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-cream-dim">{t('dashboard.minThreshold')} *</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="input py-2 text-xs"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                    />
                  </div>
                </div>

                {error && <p className="mt-3 text-xs text-rose-300 font-semibold">{error}</p>}

                <div className="mt-4 flex gap-2 justify-end">
                  <button
                    onClick={async () => {
                      if (!baseUnit) return setError(t('dashboard.baseUnitRequired'))
                      const res = await approveIngredientRequest(req.id, {
                        baseUnit,
                        initialStock: Number(initialStock) || 0,
                        threshold: Number(threshold) || 10,
                      })
                      if (res && res.error) {
                        return setError(res.error)
                      }
                      setEditingId(null)
                    }}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                  >
                    {t('dashboard.confirmApprove')}
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null)
                      setError('')
                    }}
                    className="btn-ghost px-3 py-1.5 text-xs"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}

            {/* Rejection Form (Admin Only) */}
            {rejectingId === req.id && (
              <div className="mt-4 border-t border-ink-line/50 pt-4">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wider text-rose-300">{t('dashboard.reasonForRejection')} *</label>
                  <input
                    type="text"
                    className="input py-2 text-xs"
                    placeholder={t('dashboard.rejectionPlaceholder')}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>

                <div className="mt-4 flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      if (!rejectReason.trim()) return
                      rejectIngredientRequest(req.id, rejectReason.trim())
                      setRejectingId(null)
                    }}
                    disabled={!rejectReason.trim()}
                    className="btn-danger px-3 py-1.5 text-xs"
                  >
                    {t('dashboard.confirmReject')}
                  </button>
                  <button
                    onClick={() => setRejectingId(null)}
                    className="btn-ghost px-3 py-1.5 text-xs"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// PENDING HANDOVERS PANEL (Manager / Admin)
// ============================================================================

// Cashier partial handovers awaiting a decision. Manager/Admin accepts (cash
// leaves the drawer) or rejects (with reason). Hidden when nothing is pending.
function PendingHandoversPanel() {
  const { pendingHandovers, acceptHandover, rejectHandover } = useApp()
  const t = useT()
  const [selected, setSelected] = useState(null)
  const pending = pendingHandovers.filter((h) => h.status === 'pending')
  if (pending.length === 0) return null

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center justify-between border-b border-ink-line pb-4">
        <h3 className="font-serif text-xl text-cream">⏳ {t('handover.pending')}</h3>
        <span className="badge bg-gold/15 font-semibold text-gold">{pending.length}</span>
      </div>
      <div className="space-y-3">
        {pending.map((h) => (
          <div
            key={h.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-cream">
                <span className="font-semibold">{h.fromName}</span> {t('handover.wantsToHandOver')}
              </p>
              <p className="font-serif text-2xl font-semibold text-gold">{money(h.amount)}</p>
              <p className="text-xs text-cream-dim">{time(h.initiatedAt)}</p>
            </div>
            <button onClick={() => setSelected(h)} className="btn-gold shrink-0 px-4 py-2 text-sm">
              {t('handover.review')}
            </button>
          </div>
        ))}
      </div>

      {selected && (
        <HandoverApprovalModal
          handover={selected}
          onAccept={async (id) => {
            const res = await acceptHandover(id)
            if (!res?.error) setSelected(null)
            return res
          }}
          onReject={async (id, reason) => {
            const res = await rejectHandover(id, reason)
            if (!res?.error) setSelected(null)
            return res
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

// ============================================================================
// 1. ADMIN DASHBOARD VIEW
// ============================================================================

function AdminDashboard({ stats, orders, orderTotal, attendance, lowStock }) {
  const { staff } = useApp()
  const t = useT()
  let cashTotal = 0
  let cardTotal = 0
  
  orders
    .filter((o) => o.payment === 'Paid' && !o.cancelled)
    .forEach((o) => {
      const tot = orderTotal(o.items, o.discount?.amount, o.gstRate).total
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
  const monthName = fmtMonthName(now)

  return (
    <div className="space-y-6">
      {/* Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IconOrders} label={t('dashboard.todaysOrders')} value={stats.orderCount} sub={`${stats.pending} ${t('dashboard.awaitingPayment')}`} delay={0} />
        <StatCard icon={IconTrend} label={t('dashboard.revenue')} value={money(stats.revenue)} sub={t('dashboard.collectedToday')} delay={60} />
        <StatCard icon={IconTable} label={t('dashboard.activeTables')} value={stats.activeTables} sub={t('dashboard.currentlyDining')} delay={120} />
        <StatCard icon={IconUsers} label={t('dashboard.staffPresent')} value={`${stats.present}/${stats.totalStaff}`} sub={t('dashboard.onDutyNow')} delay={180} />
      </div>

      <LowStockAlert items={lowStock} />

      <PendingHandoversPanel />

      <IngredientRequestsPanel role="Admin" />

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
              <h3 className="font-serif text-xl text-cream">{t('dashboard.paymentMethods')}</h3>
              <span className="text-xs text-cream-dim font-medium">{t('dashboard.breakdown')}</span>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-cream-dim">{t('dashboard.cashPayments')}</span>
                  <span className="font-semibold text-cream">{money(cashTotal)} ({Math.round(cashPct)}%)</span>
                </div>
                <div className="w-full h-2 bg-ink-line rounded-full overflow-hidden">
                  <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${cashPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-cream-dim">{t('dashboard.cardPayments')}</span>
                  <span className="font-semibold text-cream">{money(cardTotal)} ({Math.round(cardPct)}%)</span>
                </div>
                <div className="w-full h-2 bg-ink-line rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${cardPct}%` }} />
                </div>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-ink-line flex justify-between items-center text-xs text-cream-dim">
              <span>{t('dashboard.totalCollected')}</span>
              <span className="font-serif font-bold text-sm text-gold">{money(grandTotal)}</span>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
                <IconWallet size={20} />
              </span>
              <div>
                <h3 className="font-serif text-xl text-cream">{t('dashboard.monthlyPayroll')}</h3>
                <p className="text-xs text-cream-dim">{monthName} · {t('dashboard.estimated')}</p>
              </div>
            </div>
            <p className="mt-4 font-serif text-3xl font-semibold text-gold">{money(monthlyPayroll)}</p>
            <p className="mt-1 text-xs text-cream-dim">
              {t('dashboard.across')} {activeStaffCount} {t('dashboard.beforeDeductions')}
            </p>
            <Link
              to="/payroll"
              className="btn-ghost mt-5 w-full text-sm"
            >
              {t('dashboard.viewPayroll')} →
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
  const t = useT()
  return (
    <div className="space-y-6">
      {/* Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IconOrders} label={t('dashboard.todaysOrders')} value={stats.orderCount} sub={`${stats.pending} ${t('dashboard.awaitingPayment')}`} delay={0} />
        <StatCard icon={IconTable} label={t('dashboard.activeTables')} value={stats.activeTables} sub={t('dashboard.currentlyDining')} delay={60} />
        <StatCard icon={IconUsers} label={t('dashboard.staffPresent')} value={`${stats.present}/${stats.totalStaff}`} sub={t('dashboard.onDutyNow')} delay={120} />
        <StatCard icon={IconCash} label={t('dashboard.outstanding')} value={money(unpaidTotal)} sub={`${stats.pending} ${t('dashboard.unpaidOrders')}`} delay={180} />
      </div>

      <LowStockAlert items={lowStock} />

      <PendingHandoversPanel />

      <IngredientRequestsPanel role="Manager" />

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
  const t = useT()
  // Only tables that are currently occupied (have an active unpaid order). With
  // 300+ tables, rendering every vacant one buried the dashboard — the full
  // floor lives on the Tables page.
  const active = tables
    .map((tbl) => {
      const order = orders.find((o) => o.table === tbl.id && o.payment === 'Unpaid' && !o.cancelled)
      return order ? { tbl, order } : null
    })
    .filter(Boolean)

  return (
    <div className="card p-6">
      <div className="mb-5 flex items-center justify-between border-b border-ink-line pb-4">
        <div>
          <h3 className="font-serif text-xl text-cream">{t('dashboard.activeTablesTitle', 'Active Tables')}</h3>
          <p className="mt-0.5 text-xs text-cream-dim">
            {active.length} {t('dashboard.occupiedNow', 'occupied now')}
          </p>
        </div>
        <Link to="/tables" className="text-xs font-semibold text-gold transition hover:text-gold-deep">
          {t('dashboard.viewAllTables', 'View all tables')} →
        </Link>
      </div>

      {active.length === 0 ? (
        <p className="py-8 text-center text-sm text-cream-dim">
          {t('dashboard.noActiveTables', 'No occupied tables right now.')}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {active.map(({ tbl, order }) => (
            <div
              key={tbl.id}
              className="relative rounded-xl border border-gold bg-gold/5 p-4 shadow-gold ring-1 ring-gold/25"
            >
              <div className="flex items-start justify-between">
                <span className="font-serif text-lg font-bold text-cream">{tableLabel(tbl.id)}</span>
                <span className="rounded-md bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase text-cream-dim">
                  {tbl.seats} {t('dashboard.seats')}
                </span>
              </div>

              <div className="mt-4 space-y-1">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-gold">{t('dashboard.waiter')}</p>
                  <p className="truncate text-xs font-semibold text-cream">{order.waiter}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-cream-dim">{t('dashboard.totalBill')}</p>
                  <p className="text-xs font-bold text-gold">
                    {money(orderTotal(order.items, order.discount?.amount, order.gstRate).total)}
                  </p>
                </div>
                <span className="absolute end-2.5 top-2.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// 3. CASHIER DASHBOARD VIEW
// ============================================================================

function CashierDashboard({ stats, orders, orderTotal, unpaidTotal, onProcessBill }) {
  const t = useT()
  const unpaidOrders = orders.filter((o) => o.payment === 'Unpaid' && !o.cancelled)
  const paidOrders = orders.filter((o) => o.payment === 'Paid' && !o.cancelled)

  return (
    <div className="space-y-6">
      {/* Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IconOrders} label={t('dashboard.todaysOrders')} value={stats.orderCount} sub={t('dashboard.placedToday')} delay={0} />
        <StatCard icon={IconTrend} label={t('dashboard.collected')} value={money(stats.revenue)} sub={t('dashboard.paidRevenue')} delay={60} />
        <StatCard icon={IconCash} label={t('dashboard.pending')} value={stats.pending} sub={`${money(unpaidTotal)} ${t('dashboard.toCollect')}`} delay={120} />
        <StatCard icon={IconReceipt} label={t('dashboard.receipts')} value={orders.length} sub={t('dashboard.readyToPrint')} delay={180} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Column */}
        <div className="space-y-6 lg:col-span-2">
          <PendingBillsQueue orders={orders} orderTotal={orderTotal} onProcessBill={onProcessBill} />
          
          {/* Recent Sales History */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-line p-5">
              <h3 className="font-serif text-xl text-cream">{t('dashboard.recentPayments')}</h3>
              <span className="text-xs text-cream-dim font-medium">{t('dashboard.paidOrdersTodayLabel')}</span>
            </div>
            {paidOrders.length === 0 ? (
              <div className="p-8 text-center text-sm text-cream-dim">
                {t('dashboard.noPaymentsYet')}
              </div>
            ) : (
              <div className="divide-y divide-ink-line">
                {paidOrders.slice(0, 5).map((o) => (
                  <div key={o.id} className="flex items-center gap-4 p-4 hover:bg-white/[0.02]">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 font-serif text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/20">
                      {tableLabel(o.table)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-cream">
                        {o.id} · <span className="text-cream-dim">{o.waiter}</span>
                      </p>
                      <p className="truncate text-xs text-cream-dim">
                        {o.items.reduce((s, i) => s + i.qty, 0)} {t('common.items')} · {time(o.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-300">{money(orderTotal(o.items, o.discount?.amount, o.gstRate).total)}</p>
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
            <h3 className="font-serif text-xl text-cream">{t('dashboard.cashierDeskActions')}</h3>
            <p className="mt-1 text-xs text-cream-dim font-medium">{t('dashboard.jumpToTerminal')}</p>
            <div className="mt-5 space-y-3">
              <Link
                to="/pos"
                className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-soft p-4 transition hover:border-gold/40"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/20">
                  <IconPOS size={20} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-cream">{t('dashboard.openPos')}</p>
                  <p className="text-xs text-cream-dim">{t('dashboard.takeNewOrders')}</p>
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
                  <p className="text-sm font-semibold text-cream">{t('dashboard.printReceipts')}</p>
                  <p className="text-xs text-cream-dim">{stats.pending} {t('dashboard.billsToProcess')}</p>
                </div>
              </Link>
            </div>
            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-xs uppercase tracking-widest text-amber-300/80 font-bold">{t('dashboard.totalOutstanding')}</p>
              <p className="mt-1.5 font-serif text-3xl font-semibold text-amber-300">{money(unpaidTotal)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PendingBillsQueue({ orders, orderTotal, onProcessBill }) {
  const t = useT()
  const unpaidOrders = orders.filter((o) => o.payment === 'Unpaid' && !o.cancelled)

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-line p-5">
        <h3 className="font-serif text-xl text-cream">{t('dashboard.awaitingPaymentQueue')}</h3>
        <span className="badge bg-amber-500/12 text-amber-300 ring-1 ring-amber-500/30">
          {unpaidOrders.length} {t('dashboard.pendingBills')}
        </span>
      </div>
      {unpaidOrders.length === 0 ? (
        <div className="p-12 text-center text-sm text-cream-dim">
          {t('dashboard.allBillsPaid')}
        </div>
      ) : (
        <div className="divide-y divide-ink-line">
          {unpaidOrders.map((o) => (
            <div key={o.id} className="flex flex-col gap-3 p-4 hover:bg-white/[0.01] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-serif font-bold text-gold text-lg">{tableLabel(o.table)}</span>
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
                  <p className="text-sm font-semibold text-cream">{money(orderTotal(o.items, o.discount?.amount, o.gstRate).total)}</p>
                  <p className="text-[10px] text-cream-dim">{time(o.createdAt)}</p>
                </div>
                <button
                  onClick={() => onProcessBill(o)}
                  className="btn-gold px-3.5 py-1.5 text-xs font-bold shrink-0"
                >
                  {t('dashboard.processBill')}
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
  const t = useT()
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
    .reduce((s, o) => s + orderTotal(o.items, o.discount?.amount, o.gstRate).total, 0)

  // Role-specific headers and page headings
  const heading = {
    Admin: { title: t('dashboard.adminTitle'), sub: t('dashboard.adminSub') },
    Manager: { title: t('dashboard.managerTitle'), sub: t('dashboard.managerSub') },
    Cashier: { title: t('dashboard.cashierTitle'), sub: t('dashboard.cashierSub') },
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
          <IconPOS size={18} /> {t('nav.newOrder')}
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
