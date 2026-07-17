import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT, useLang } from '../i18n/LanguageContext.jsx'
import { categoryLabel } from '../i18n/dataDict.js'
import { PageHeader } from '../components/ui.jsx'
import { money, dateShort, monthYear, dateLong } from '../utils/format.js'
import { safePrint } from '../utils/print.js'
import { monthFigures } from '../utils/accounting.js'
import { complimentaryCost, formatCostTotal } from '../utils/cost.js'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../data/mockData.js'
import {
  IconChart,
  IconTrend,
  IconTrendDown,
  IconWallet,
  IconPlus,
  IconTrash,
  IconClose,
  IconPrint,
  IconCheck,
} from '../components/Icons.jsx'

const toDayStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ---------------------------------------------------------------------------
function StatTile({ icon: Icon, label, value, sub, tone }) {
  const tones = {
    green: 'text-emerald-300',
    red: 'text-rose-300',
    gold: 'text-gold',
    blue: 'text-sky-300',
  }
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-cream-dim">{label}</p>
          <p className={`mt-2 font-serif text-3xl font-semibold ${tones[tone]}`}>{value}</p>
          {sub && <p className="mt-1 text-xs text-cream-dim">{sub}</p>}
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-cream-dim ring-1 ring-ink-line">
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
function PLChart({ data }) {
  const t = useT()
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]))
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl text-cream">{t('accounting.profitAndLoss')}</h3>
        <div className="flex items-center gap-3 text-[11px] text-cream-dim">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-emerald-400" /> {t('accounting.income')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-rose-400" /> {t('accounting.expenses')}
          </span>
        </div>
      </div>
      <div className="mt-6 flex h-56 items-end gap-3">
        {data.map((d) => (
          <div key={d.label} className="group flex flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end justify-center gap-1">
              <div
                className="w-1/2 rounded-t-md bg-emerald-500/70 transition-all duration-500 group-hover:bg-emerald-400"
                style={{ height: `${Math.max(3, (d.income / max) * 100)}%` }}
                title={`Income ${money(d.income)}`}
              />
              <div
                className="w-1/2 rounded-t-md bg-rose-500/70 transition-all duration-500 group-hover:bg-rose-400"
                style={{ height: `${Math.max(3, (d.expense / max) * 100)}%` }}
                title={`Expenses ${money(d.expense)}`}
              />
            </div>
            <span className="text-[10px] text-cream-dim">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
function ExpenseBreakdown({ inMonth, payroll }) {
  const t = useT()
  const rows = useMemo(() => {
    const map = {}
    inMonth
      .filter((tx) => tx.type === 'expense')
      .forEach((tx) => {
        map[tx.category] = (map[tx.category] || 0) + tx.amount
      })
    if (payroll > 0) map.Salaries = (map.Salaries || 0) + payroll
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [inMonth, payroll])

  const total = rows.reduce((s, [, v]) => s + v, 0)

  return (
    <div className="card p-6">
      <h3 className="font-serif text-xl text-cream">{t('accounting.expenseBreakdown')}</h3>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-cream-dim">{t('accounting.noExpenses')}</p>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map(([cat, amt]) => (
            <div key={cat}>
              <div className="flex justify-between text-xs">
                <span className="text-cream-dim">{cat}</span>
                <span className="font-semibold text-cream">{money(amt)}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-line">
                <div
                  className="h-full rounded-full bg-rose-400/80"
                  style={{ width: `${total > 0 ? (amt / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function AddTransactionModal({ onClose, onSave }) {
  const t = useT()
  const [type, setType] = useState('expense')
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const valid = Number(amount) > 0 && description.trim()

  const changeType = (t) => {
    setType(t)
    setCategory((t === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <h3 className="font-serif text-2xl text-cream">{t('accounting.addTransaction')}</h3>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          {/* Type toggle */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            {['income', 'expense'].map((ty) => (
              <button
                key={ty}
                onClick={() => changeType(ty)}
                className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                  type === ty
                    ? ty === 'income'
                      ? 'border-emerald-500/50 bg-emerald-500/12 text-emerald-300'
                      : 'border-rose-500/50 bg-rose-500/12 text-rose-300'
                    : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                }`}
              >
                {ty === 'income' ? t('accounting.typeIncome') : t('accounting.typeExpense')}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('accounting.category')}
              </label>
              <select className="input py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
                {cats.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('accounting.description')}
              </label>
              <input
                className="input"
                placeholder={t('accounting.descriptionPh')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  {t('accounting.amountRs')}
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
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  {t('accounting.date')}
                </label>
                <input
                  type="date"
                  className="input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              {t('common.cancel')}
            </button>
            <button
              onClick={() => {
                onSave({
                  type,
                  category,
                  description: description.trim(),
                  amount: Number(amount),
                  date: new Date(date).toISOString(),
                })
                onClose()
              }}
              disabled={!valid}
              className="btn-gold flex-1 py-3 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconCheck size={18} /> {t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
export default function Accounting() {
  const { transactions, addTransaction, deleteTransaction, staff, orders, orderTotal, menu } = useApp()
  const { t, lang } = useLang()
  const today = useMemo(() => new Date(), [])

  const monthOptions = useMemo(() => {
    const opts = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      opts.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: monthYear(d),
      })
    }
    return opts
  }, [today])

  const [accView, setAccView] = useState('monthly') // 'daily' | 'monthly'
  const [monthKey, setMonthKey] = useState(monthOptions[0].key)
  const [dayDate, setDayDate] = useState(() => toDayStr(today))
  const [showAdd, setShowAdd] = useState(false)

  const minDay = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate())
    return toDayStr(d)
  }, [today])
  const maxDay = useMemo(() => toDayStr(today), [today])

  const [year, mon] = monthKey.split('-').map(Number)
  const monthIndex = mon - 1
  const monthLabel = monthOptions.find((m) => m.key === monthKey)?.label

  const fig = useMemo(
    () => monthFigures(transactions, year, monthIndex, today, staff),
    [transactions, year, monthIndex, today],
  )

  // Daily figures — a single day's ledger. Payroll is a monthly cost, so it
  // isn't apportioned to any one day; daily P&L is manual income vs expense.
  const dayFig = useMemo(() => {
    const inDay = transactions.filter((tx) => toDayStr(new Date(tx.date)) === dayDate)
    const income = inDay.filter((tx) => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0)
    const expense = inDay.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0)
    const profit = income - expense
    const margin = income > 0 ? (profit / income) * 100 : 0
    return { inDay, income, expense, profit, margin }
  }, [transactions, dayDate])

  const dayLabel = useMemo(() => dateLong(`${dayDate}T00:00:00`), [dayDate])

  const chartData = useMemo(
    () =>
      monthOptions
        .slice()
        .reverse()
        .map((opt) => {
          const [y, m] = opt.key.split('-').map(Number)
          const f = monthFigures(transactions, y, m - 1, today, staff)
          return { label: opt.label.slice(0, 3), income: f.income, expense: f.expense }
        }),
    [transactions, monthOptions, today, staff],
  )

  // Ledger rows = manual transactions + a read-only auto payroll expense line.
  const rows = useMemo(() => {
    const list = [...fig.inMonth]
    if (fig.payroll > 0) {
      list.push({
        id: 'AUTO-PAYROLL',
        type: 'expense',
        category: 'Salaries',
        description: t('accounting.staffPayrollAuto'),
        amount: fig.payroll,
        date: new Date(year, monthIndex + 1, 0).toISOString(),
        auto: true,
      })
    }
    return list.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [fig, year, monthIndex, t])

  const dayRows = useMemo(
    () => [...dayFig.inDay].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [dayFig],
  )

  const daily = accView === 'daily'
  const figures = daily ? dayFig : fig
  const scopeLabel = daily ? dayLabel : monthLabel
  const ledgerRows = daily ? dayRows : rows

  // Complimentary (free / on-the-house) orders in the selected period — shown as
  // lost revenue, kept separate from the manual ledger.
  const compStat = useMemo(() => {
    const inScope = orders.filter((o) => {
      if (o.payment !== 'Complimentary' || o.cancelled) return false
      const d = new Date(o.createdAt)
      return daily ? toDayStr(d) === dayDate : d.getFullYear() === year && d.getMonth() === monthIndex
    })
    return {
      count: inScope.length,
      value: inScope.reduce((s, o) => s + orderTotal(o.items, o.discount?.amount).total, 0),
      // What the giveaways actually cost: ingredient spend, not the forgone
      // bill. Only this figure belongs in the books as a loss.
      cost: inScope.reduce((s, o) => s + complimentaryCost(o, menu, orderTotal).costTotal, 0),
      costAllKnown: inScope.every((o) => complimentaryCost(o, menu, orderTotal).allKnown),
    }
  }, [orders, orderTotal, menu, daily, dayDate, year, monthIndex])

  return (
    <div>
      <PageHeader title={t('accounting.title')} subtitle={t('accounting.subtitle')}>
        <div className="flex flex-wrap items-center gap-2 no-print">
          <div className="flex overflow-hidden rounded-xl border border-ink-line">
            {['daily', 'monthly'].map((v) => (
              <button
                key={v}
                onClick={() => setAccView(v)}
                className={`px-4 py-2 text-sm font-semibold transition ${
                  accView === v
                    ? 'bg-gold/15 text-gold'
                    : 'bg-ink-soft text-cream-dim hover:text-cream'
                }`}
              >
                {t(`accounting.${v}`)}
              </button>
            ))}
          </div>
          {daily ? (
            <input
              type="date"
              className="input w-44 py-2"
              value={dayDate}
              min={minDay}
              max={maxDay}
              onChange={(e) => setDayDate(e.target.value)}
            />
          ) : (
            <select
              className="input w-48 py-2"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
            >
              {monthOptions.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </PageHeader>

      {/* Quick stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={IconTrend} label={t('accounting.income')} value={money(figures.income)} sub={scopeLabel} tone="green" />
        <StatTile
          icon={IconTrendDown}
          label={t('accounting.expenses')}
          value={money(figures.expense)}
          sub={daily ? scopeLabel : t('accounting.inclPayroll')}
          tone="red"
        />
        <StatTile
          icon={IconWallet}
          label={t('accounting.netProfit')}
          value={money(figures.profit)}
          sub={figures.profit >= 0 ? t('accounting.profit') : t('accounting.loss')}
          tone={figures.profit >= 0 ? 'gold' : 'red'}
        />
        <StatTile
          icon={IconChart}
          label={t('accounting.profitMargin')}
          value={`${Math.round(figures.margin)}%`}
          sub={t('accounting.profitOverIncome')}
          tone={figures.margin >= 0 ? 'blue' : 'red'}
        />
      </div>

      {compStat.count > 0 && (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-violet-500/30 bg-violet-500/[0.06] p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-500/12 text-violet-300 ring-1 ring-violet-500/25">🎁</span>
            <div>
              <p className="text-sm font-semibold text-cream">{t('accounting.complimentary')}</p>
              <p className="text-xs text-cream-dim">
                {compStat.count} {t('accounting.complimentaryOrders')} · {scopeLabel}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-serif text-2xl font-semibold text-violet-300">
              {formatCostTotal({ costTotal: compStat.cost, allKnown: compStat.costAllKnown }, money)}
            </p>
            <p className="text-[11px] text-cream-dim">
              est. cost · bill forgone {money(compStat.value)}
            </p>
          </div>
        </div>
      )}

      {!daily && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PLChart data={chartData} />
          </div>
          <ExpenseBreakdown inMonth={fig.inMonth} payroll={fig.payroll} />
        </div>
      )}

      {/* Ledger */}
      <div className="mt-6 card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-ink-line p-5 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-serif text-xl text-cream">{t('accounting.transactions')} · {scopeLabel}</h3>
          <div className="flex gap-2 no-print">
            <button onClick={safePrint} className="btn-ghost px-4 py-2 text-sm">
              <IconPrint size={16} /> {t('accounting.printReport')}
            </button>
            <button onClick={() => setShowAdd(true)} className="btn-gold px-4 py-2 text-sm">
              <IconPlus size={16} /> {t('accounting.addTransaction')}
            </button>
          </div>
        </div>

        {ledgerRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-cream-dim">
            {t('accounting.noTransactions')} {scopeLabel}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-line text-xs uppercase tracking-wider text-cream-dim">
                  <th className="px-5 py-3 font-semibold">{t('accounting.colDate')}</th>
                  <th className="px-5 py-3 font-semibold">{t('accounting.colDescription')}</th>
                  <th className="px-5 py-3 font-semibold">{t('accounting.colCategory')}</th>
                  <th className="px-5 py-3 text-right font-semibold">{t('accounting.colAmount')}</th>
                  <th className="px-5 py-3 text-right font-semibold no-print">{t('accounting.colAction')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line">
                {ledgerRows.map((tx) => {
                  const income = tx.type === 'income'
                  return (
                    <tr key={tx.id} className="transition hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-cream-dim">{dateShort(tx.date)}</td>
                      <td className="px-5 py-3">
                        <span className="text-cream">{tx.description}</span>
                        {tx.auto && (
                          <span className="ms-2 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-cream-dim">
                            {t('accounting.auto')}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-cream-dim">{categoryLabel(tx.category, lang)}</td>
                      <td
                        className={`px-5 py-3 text-right font-semibold ${
                          income ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {income ? '+' : '−'} {money(tx.amount)}
                      </td>
                      <td className="px-5 py-3 text-right no-print">
                        {tx.auto ? (
                          <span className="text-xs text-cream-dim">—</span>
                        ) : (
                          <button
                            onClick={() => deleteTransaction(tx.id)}
                            className="text-cream-dim transition hover:text-rose-300"
                            title={t('common.delete')}
                          >
                            <IconTrash size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <AddTransactionModal onClose={() => setShowAdd(false)} onSave={addTransaction} />
      )}
    </div>
  )
}
