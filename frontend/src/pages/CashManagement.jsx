import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
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
// Advance). Not translated — it's a data value (Transaction.category), not UI text.
const USE_CATEGORY = 'Cash Management'

const PERIODS = [
  { key: 'daily', labelKey: 'cashManagement.periodDaily', fallback: 'Daily' },
  { key: 'weekly', labelKey: 'cashManagement.periodWeekly', fallback: 'Weekly' },
  { key: 'monthly', labelKey: 'cashManagement.periodMonthly', fallback: 'Monthly' },
  { key: 'yearly', labelKey: 'cashManagement.periodYearly', fallback: 'Yearly' },
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
  const t = useT()
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
            <h3 className="font-serif text-2xl text-cream">{t('cashManagement.useModalTitle', 'Use Amount')}</h3>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('cashManagement.amountRs', 'Amount (Rs)')}
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
                <p className="mt-1 text-[11px] text-cream-dim">
                  {t('cashManagement.available', 'Available')}: {money(available)}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('cashManagement.descriptionLabel', 'Description — where is this amount being used?')}
              </label>
              <textarea
                rows={3}
                className="input"
                placeholder={t('cashManagement.descriptionPh', 'e.g. Advance to gas supplier')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              onClick={submit}
              disabled={!valid || saving}
              className="btn-gold flex-1 py-3 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconCheck size={18} /> {saving ? t('cashManagement.saving', 'Saving…') : t('cashManagement.confirm', 'Confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// One account's Online-paid orders from the last 30 days, plus their total —
// the "audit trail" behind the balance shown on its card. Reads straight off
// context state (orders/orderTotal), no new endpoint needed.
function AccountStatementModal({ account, orders, orderTotal, onClose }) {
  const t = useT()
  useEscapeKey(onClose)
  const since = useMemo(() => Date.now() - 30 * 24 * 60 * 60 * 1000, [])
  const rows = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            o.payment === 'Paid' &&
            o.method === 'Online' &&
            o.onlineAccountName === account.name &&
            new Date(o.createdAt).getTime() >= since,
        )
        .map((o) => ({
          id: o.id,
          table: o.table,
          createdAt: o.createdAt,
          amount: orderTotal(o.items, o.discount?.amount, o.gstRate).total,
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [orders, account.name, since, orderTotal],
  )
  const total = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h3 className="truncate font-serif text-2xl text-cream">{account.name}</h3>
              <p className="mt-1 text-xs text-cream-dim">
                {t('cashManagement.last30Days', 'Last 30 days')} ·{' '}
                {[account.type, account.bankName, account.number].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
            <button onClick={onClose} className="shrink-0 text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5">
            {rows.length === 0 ? (
              <p className="text-sm text-cream-dim">
                {t('cashManagement.noStatementEntries', 'No online payments on this account in the last 30 days.')}
              </p>
            ) : (
              <ul className="divide-y divide-ink-line">
                {rows.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <p className="text-cream">
                        {r.id}
                        {r.table ? ` · Table ${r.table}` : ''}
                      </p>
                      <p className="text-[11px] text-cream-dim">
                        {dateShort(r.createdAt)} · {time(r.createdAt)}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-gold">{money(r.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {rows.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-ink-line pt-3">
              <span className="text-sm font-semibold text-cream">{t('cashManagement.total', 'Total')}</span>
              <span className="font-serif text-lg font-semibold text-gold">{money(total)}</span>
            </div>
          )}

          <button onClick={onClose} className="btn-ghost mt-6 w-full py-3">
            {t('cashManagement.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CashManagement() {
  const t = useT()
  const { dailyClosings, onlineAccounts, transactions, orders, orderTotal, user, addTransaction, deleteTransaction } = useApp()
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
        orphaned: false,
        amount: totals.byAccount[a.name] || 0,
      }
    })
    // A historical account name that no longer matches a live Settings entry
    // (renamed/removed) still keeps its collected total visible here instead
    // of silently dropping off the page — orders/closings snapshot the name at
    // payment time and never get rewritten on a later rename, so this isn't a
    // second real account, just that name's own past money. Flagged
    // `orphaned` so the card renders as "history," not a peer account.
    Object.entries(totals.byAccount).forEach(([name, amount]) => {
      if (!seen.has(name))
        rows.push({ id: name, name, type: null, number: null, bankName: null, active: false, orphaned: true, amount })
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
  const [statementFor, setStatementFor] = useState(null)

  const recordUse = ({ amount, description }) =>
    addTransaction({ type: 'expense', category: USE_CATEGORY, description, amount, date: new Date().toISOString() })

  return (
    <div>
      <PageHeader
        title={t('cashManagement.title', 'Cash Management')}
        subtitle={t(
          'cashManagement.subtitle',
          'Cash, card & online totals collected across every saved day closing.',
        )}
      >
        {canManage && (
          <button onClick={() => setModalOpen(true)} className="btn-gold px-4 py-2 text-sm">
            <IconPlus size={16} /> {t('cashManagement.useAmount', 'Use Amount')}
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={IconCash} label={t('cashManagement.statCash', 'Cash')} value={money(totals.cash)} />
        <StatCard icon={IconWallet} label={t('cashManagement.statCard', 'Card')} value={money(totals.card)} />
        <StatCard icon={IconWallet} label={t('cashManagement.statOnline', 'Online')} value={money(totals.online)} />
        <StatCard icon={IconChart} label={t('cashManagement.statGrandTotal', 'Grand Total')} value={money(grandTotal)} />
        <StatCard
          icon={IconCash}
          label={t('cashManagement.statRemaining', 'Remaining')}
          value={money(remaining)}
          sub={totalUsed > 0 ? `${money(totalUsed)} ${t('cashManagement.usedSuffix', 'used')}` : undefined}
        />
      </div>

      <div className="card mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-lg text-cream">{t('cashManagement.breakdownTitle', 'Cash Breakdown')}</h3>
          <div className="flex gap-1 rounded-lg border border-ink-line bg-ink-soft p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setGranularity(p.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  granularity === p.key ? 'bg-gold text-ink' : 'text-cream-dim hover:text-cream'
                }`}
              >
                {t(p.labelKey, p.fallback)}
              </button>
            ))}
          </div>
        </div>

        {periodRows.length === 0 ? (
          <p className="mt-4 text-sm text-cream-dim">{t('cashManagement.noClosings', 'No closings saved yet.')}</p>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-line text-left text-[11px] uppercase tracking-wider text-cream-dim">
                    <th className="py-2 pr-3 font-semibold">{t('cashManagement.colPeriod', 'Period')}</th>
                    <th className="py-2 px-3 text-right font-semibold">{t('cashManagement.colCash', 'Cash')}</th>
                    <th className="py-2 px-3 text-right font-semibold">{t('cashManagement.colCard', 'Card')}</th>
                    <th className="py-2 px-3 text-right font-semibold">{t('cashManagement.colOnline', 'Online')}</th>
                    <th className="py-2 pl-3 text-right font-semibold">{t('cashManagement.colTotal', 'Total')}</th>
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
                  {t('cashManagement.loadMore', 'Load more')} · {Math.min(periodVisibleCount, periodRows.length)}/
                  {periodRows.length}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card mt-6 p-6">
        <div>
          <h3 className="font-serif text-lg text-cream">{t('cashManagement.accountsTitle', 'Online Payment Accounts')}</h3>
          <p className="mt-1 text-xs text-cream-dim">
            {t(
              'cashManagement.accountsSubtitle',
              'Destinations a cashier can attribute an Online payment to (JazzCash, Easypaisa, bank…).',
            )}
          </p>
        </div>

        {accountRows.length === 0 ? (
          <div className="mt-5 rounded-xl border border-ink-line bg-ink-soft/40 px-4 py-8 text-center">
            <p className="text-sm text-cream-dim">{t('cashManagement.noAccounts', 'No payment accounts configured.')}</p>
            <Link to="/settings" className="mt-2 inline-block text-sm font-semibold text-gold hover:underline">
              {t('cashManagement.addFromSettings', 'Add one from Settings')} →
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accountRows.map((a) => (
              <div
                key={a.id}
                className={`flex flex-col rounded-xl border p-5 transition ${
                  a.orphaned
                    ? 'border-dashed border-ink-line/70 bg-ink-soft/20'
                    : 'border-ink-line bg-ink-soft/40 hover:border-gold/60 hover:bg-ink-soft/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 ${
                      a.orphaned ? 'bg-white/5 text-cream-dim ring-ink-line' : 'bg-gold/10 text-gold ring-gold/25'
                    }`}
                  >
                    <IconWallet size={16} />
                  </span>
                  <p className="min-w-0 truncate font-semibold text-cream">{a.name}</p>
                </div>
                <p className="mt-2 text-xs text-cream-dim">
                  {a.orphaned
                    ? t('cashManagement.noLongerConfigured', 'No longer configured in Settings')
                    : [a.type, a.bankName, a.number].filter(Boolean).join(' · ') || '—'}
                </p>

                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-wider text-cream-dim">
                    {t('cashManagement.balance', 'Balance')}
                  </p>
                  <p className={`mt-1 font-serif text-xl font-semibold ${a.active ? 'text-gold' : 'text-cream-dim'}`}>
                    {money(a.amount)}
                  </p>
                </div>

                <span
                  className={`badge mt-3 self-start ring-1 ${
                    a.orphaned
                      ? 'bg-ink-soft text-cream-dim ring-ink-line'
                      : a.active
                        ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25'
                        : 'bg-ink-soft text-cream-dim ring-ink-line'
                  }`}
                >
                  {a.orphaned
                    ? t('cashManagement.formerAccount', 'Former account')
                    : a.active
                      ? t('settings.active', 'Active')
                      : t('settings.inactive', 'Inactive')}
                </span>

                <button
                  onClick={() => setStatementFor(a)}
                  disabled={!a.orphaned && !a.active}
                  className="btn-ghost mt-4 w-full py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('cashManagement.viewStatement', 'View Statement')}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-ink-line pt-3">
          <span className="text-sm font-semibold text-cream">{t('cashManagement.totalOnline', 'Total Online')}</span>
          <span className="font-serif text-lg font-semibold text-gold">{money(totals.online)}</span>
        </div>
      </div>

      <div className="card mt-6 p-6">
        <h3 className="font-serif text-lg text-cream">{t('cashManagement.usedTitle', 'Cash Used')}</h3>
        {usedEntries.length === 0 ? (
          <p className="mt-4 text-sm text-cream-dim">{t('cashManagement.noUsed', 'Nothing recorded yet.')}</p>
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
                      title={t('cashManagement.deleteTitle', 'Delete')}
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
            <span className="text-sm font-semibold text-cream">{t('cashManagement.totalUsed', 'Total Used')}</span>
            <span className="font-serif text-lg font-semibold text-amber-300">{money(totalUsed)}</span>
          </div>
        )}
      </div>

      {modalOpen && <UseAmountModal available={remaining} onClose={() => setModalOpen(false)} onSave={recordUse} />}
      {statementFor && (
        <AccountStatementModal
          account={statementFor}
          orders={orders}
          orderTotal={orderTotal}
          onClose={() => setStatementFor(null)}
        />
      )}
    </div>
  )
}
