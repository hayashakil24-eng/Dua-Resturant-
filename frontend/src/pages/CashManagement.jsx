import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, StatCard } from '../components/ui.jsx'
import { money, dateShort, dateLong, monthYear, time } from '../utils/format.js'
import { toDayStr } from '../utils/closing.js'
import { canModify } from '../config/permissions.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { IconWallet, IconCash, IconChart, IconPlus, IconClose, IconCheck, IconTrash } from '../components/Icons.jsx'

// Fixed category tagging "Use Amount" spends recorded from this page — lets
// them be pulled back out of the shared Transaction ledger (they still show
// up in Accounting like any other expense) without a schema change, same
// trick as Accounting.jsx's other fixed categories (Inventory Purchase, Staff
// Advance).
const USE_CATEGORY = 'Cash Management'

const PERIODS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
]
const PERIOD_PAGE_SIZE = 20

// A closing's own `date` label is enough to bucket it by day/month/year;
// weekly buckets to the Monday that starts the week containing that date, so
// a week's cash reads as one row instead of scattering across two calendar
// months at the boundary.
function periodKeyOf(rec, granularity) {
  if (granularity === 'daily') return rec.date
  if (granularity === 'monthly') return rec.date.slice(0, 7)
  if (granularity === 'yearly') return rec.date.slice(0, 4)
  const d = new Date(`${rec.date}T00:00:00`)
  const dow = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - dow)
  return toDayStr(d)
}

function periodLabelOf(key, granularity) {
  if (granularity === 'daily') return dateLong(`${key}T00:00:00`)
  if (granularity === 'monthly') return monthYear(`${key}-01T00:00:00`)
  if (granularity === 'yearly') return key
  const start = new Date(`${key}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${dateShort(start)} – ${dateShort(end)}`
}

function UseAmountModal({ available, onClose, onSave }) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEscapeKey(onClose)

  const valid = Number(amount) > 0 && description.trim().length > 0

  const submit = async () => {
    if (!valid || saving) return
    setSaving(true)
    setError('')
    const res = await onSave({ amount: Number(amount), description: description.trim() })
    setSaving(false)
    if (res?.error) return setError(res.error)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <h3 className="font-serif text-2xl text-cream">Use Amount</h3>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                Amount (Rs)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className="input"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {available != null && (
                <p className="mt-1 text-[11px] text-cream-dim">Available: {money(available)}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                Description — where is this amount being used?
              </label>
              <textarea
                rows={3}
                className="input"
                placeholder="e.g. Advance to gas supplier"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!valid || saving}
              className="btn-gold flex-1 py-3 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconCheck size={18} /> {saving ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CashManagement() {
  const { dailyClosings, onlineAccounts, transactions, user, addTransaction, deleteTransaction } = useApp()
  const canManage = user && canModify(user.role, 'cashManagement')

  // Cumulative totals across every saved closing — each closing's cash/card/
  // online figures are already scoped to that session by buildClosingReport
  // (backend/src/core/closing.ts), so this just sums them across history
  // rather than recomputing anything from live orders.
  const totals = useMemo(() => {
    let cash = 0
    let card = 0
    let online = 0
    const byAccount = {}
    for (const rec of dailyClosings) {
      cash += rec.cash || 0
      card += rec.card || 0
      online += rec.online || 0
      for (const [name, amount] of rec.onlineByAccount || []) {
        byAccount[name] = (byAccount[name] || 0) + amount
      }
    }
    return { cash, card, online, byAccount }
  }, [dailyClosings])

  // Every configured Online Payment Account (Settings), paired with its
  // collected total so far — a new account added in Settings shows up here
  // automatically at Rs 0 until it collects something, no code change needed.
  const accountRows = useMemo(() => {
    const seen = new Set()
    const rows = onlineAccounts.map((a) => {
      seen.add(a.name)
      return {
        id: a.id,
        name: a.name,
        type: a.type,
        number: a.number,
        bankName: a.bankName,
        active: a.active,
        amount: totals.byAccount[a.name] || 0,
      }
    })
    // A historical account name that no longer matches a live Settings entry
    // (renamed/removed) still keeps its collected total visible here instead
    // of silently dropping off the page.
    Object.entries(totals.byAccount).forEach(([name, amount]) => {
      if (!seen.has(name)) rows.push({ id: name, name, type: null, number: null, bankName: null, active: false, amount })
    })
    return rows.sort((a, b) => b.amount - a.amount)
  }, [onlineAccounts, totals.byAccount])

  const grandTotal = totals.cash + totals.card + totals.online

  // Date/week/month/year breakdown — "is date ko itna cash tha" — each
  // closing's own cash/card/online bucketed by the selected granularity,
  // newest period first.
  const [granularity, setGranularity] = useState('daily')
  const [periodVisibleCount, setPeriodVisibleCount] = useState(PERIOD_PAGE_SIZE)
  useEffect(() => setPeriodVisibleCount(PERIOD_PAGE_SIZE), [granularity])

  const periodRows = useMemo(() => {
    const map = new Map()
    for (const rec of dailyClosings) {
      const key = periodKeyOf(rec, granularity)
      const cur = map.get(key) || { key, cash: 0, card: 0, online: 0 }
      cur.cash += rec.cash || 0
      cur.card += rec.card || 0
      cur.online += rec.online || 0
      map.set(key, cur)
    }
    return Array.from(map.values())
      .map((r) => ({ ...r, total: r.cash + r.card + r.online, label: periodLabelOf(r.key, granularity) }))
      .sort((a, b) => (a.key < b.key ? 1 : -1))
  }, [dailyClosings, granularity])

  const usedEntries = useMemo(
    () =>
      transactions
        .filter((tx) => tx.type === 'expense' && tx.category === USE_CATEGORY)
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [transactions],
  )
  const totalUsed = usedEntries.reduce((s, tx) => s + tx.amount, 0)
  const remaining = grandTotal - totalUsed

  const [modalOpen, setModalOpen] = useState(false)

  const recordUse = ({ amount, description }) =>
    addTransaction({ type: 'expense', category: USE_CATEGORY, description, amount, date: new Date().toISOString() })

  return (
    <div>
      <PageHeader
        title="Cash Management"
        subtitle="Cash, card & online totals collected across every saved day closing."
      >
        {canManage && (
          <button onClick={() => setModalOpen(true)} className="btn-gold px-4 py-2 text-sm">
            <IconPlus size={16} /> Use Amount
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={IconCash} label="Cash" value={money(totals.cash)} />
        <StatCard icon={IconWallet} label="Card" value={money(totals.card)} />
        <StatCard icon={IconWallet} label="Online" value={money(totals.online)} />
        <StatCard icon={IconChart} label="Grand Total" value={money(grandTotal)} />
        <StatCard
          icon={IconCash}
          label="Remaining"
          value={money(remaining)}
          sub={totalUsed > 0 ? `${money(totalUsed)} used` : undefined}
        />
      </div>

      <div className="card mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-lg text-cream">Cash Breakdown</h3>
          <div className="flex gap-1 rounded-lg border border-ink-line bg-ink-soft p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setGranularity(p.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  granularity === p.key ? 'bg-gold text-ink' : 'text-cream-dim hover:text-cream'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {periodRows.length === 0 ? (
          <p className="mt-4 text-sm text-cream-dim">No closings saved yet.</p>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-line text-left text-[11px] uppercase tracking-wider text-cream-dim">
                    <th className="py-2 pr-3 font-semibold">Period</th>
                    <th className="py-2 px-3 text-right font-semibold">Cash</th>
                    <th className="py-2 px-3 text-right font-semibold">Card</th>
                    <th className="py-2 px-3 text-right font-semibold">Online</th>
                    <th className="py-2 pl-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-line">
                  {periodRows.slice(0, periodVisibleCount).map((r) => (
                    <tr key={r.key}>
                      <td className="py-2.5 pr-3 text-cream">{r.label}</td>
                      <td className="py-2.5 px-3 text-right text-cream-dim">{money(r.cash)}</td>
                      <td className="py-2.5 px-3 text-right text-cream-dim">{money(r.card)}</td>
                      <td className="py-2.5 px-3 text-right text-cream-dim">{money(r.online)}</td>
                      <td className="py-2.5 pl-3 text-right font-semibold text-gold">{money(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {periodVisibleCount < periodRows.length && (
              <div className="mt-4 flex justify-center border-t border-ink-line pt-4">
                <button
                  onClick={() => setPeriodVisibleCount((c) => c + PERIOD_PAGE_SIZE)}
                  className="btn-ghost px-5 py-2 text-sm"
                >
                  Load more · {Math.min(periodVisibleCount, periodRows.length)}/{periodRows.length}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card mt-6 p-6">
        <h3 className="font-serif text-lg text-cream">Online Payment Accounts</h3>
        {accountRows.length === 0 ? (
          <p className="mt-4 text-sm text-cream-dim">No online accounts configured yet — add one from Settings.</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-line">
            {accountRows.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-cream">
                    {a.name}
                    {a.type && (
                      <span
                        className={`badge ring-1 ${
                          a.active
                            ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25'
                            : 'bg-ink-soft text-cream-dim ring-ink-line'
                        }`}
                      >
                        {a.active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-cream-dim">
                    {[a.type, a.bankName, a.number].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="font-serif text-lg font-semibold text-gold">{money(a.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-ink-line pt-3">
          <span className="text-sm font-semibold text-cream">Total Online</span>
          <span className="font-serif text-lg font-semibold text-gold">{money(totals.online)}</span>
        </div>
      </div>

      <div className="card mt-6 p-6">
        <h3 className="font-serif text-lg text-cream">Cash Used</h3>
        {usedEntries.length === 0 ? (
          <p className="mt-4 text-sm text-cream-dim">Nothing recorded yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-line">
            {usedEntries.map((tx) => (
              <li key={tx.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-cream">{tx.description}</p>
                  <p className="text-[11px] text-cream-dim">
                    {dateShort(tx.date)} · {time(tx.date)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-amber-300">{money(tx.amount)}</span>
                  {canManage && (
                    <button
                      onClick={() => deleteTransaction(tx.id)}
                      className="text-cream-dim transition hover:text-rose-300"
                      title="Delete"
                    >
                      <IconTrash size={16} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {usedEntries.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-ink-line pt-3">
            <span className="text-sm font-semibold text-cream">Total Used</span>
            <span className="font-serif text-lg font-semibold text-amber-300">{money(totalUsed)}</span>
          </div>
        )}
      </div>

      {modalOpen && <UseAmountModal available={remaining} onClose={() => setModalOpen(false)} onSave={recordUse} />}
    </div>
  )
}
