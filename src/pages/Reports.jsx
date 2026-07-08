import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/ui.jsx'
import { money } from '../utils/format.js'
import { monthFigures } from '../utils/accounting.js'
import { RECIPE_MAP } from '../data/mockData.js'
import { IconPrint, IconWhatsApp } from '../components/Icons.jsx'

const toDayStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function topSelling(orderList, n = 5) {
  const map = {}
  orderList.forEach((o) =>
    o.items.forEach((it) => {
      map[it.name] = (map[it.name] || 0) + it.qty
    }),
  )
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
}

// Estimated ingredient consumption from the period's orders (via RECIPE_MAP).
function estimateStockUsed(orderList) {
  const map = {}
  orderList.forEach((o) =>
    o.items.forEach((it) => {
      ;(RECIPE_MAP[it.id] || []).forEach((r) => {
        const cur = map[r.name] || { qty: 0, unit: r.unit }
        cur.qty += r.qty * it.qty
        map[r.name] = cur
      })
    }),
  )
  return Object.entries(map)
    .map(([name, v]) => ({ name, qty: Math.round(v.qty * 10) / 10, unit: v.unit }))
    .sort((a, b) => b.qty - a.qty)
}

function Row({ label, value, tone = 'text-neutral-900', strong }) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${
        strong ? 'mt-1 border-t-2 border-neutral-400 pt-2.5' : ''
      }`}
    >
      <span className={strong ? 'text-sm font-bold text-neutral-900' : 'text-sm text-neutral-600'}>
        {label}
      </span>
      <span className={`${strong ? 'text-xl font-bold' : 'text-sm font-semibold'} ${tone}`}>
        {value}
      </span>
    </div>
  )
}

export default function Reports() {
  const { orders, orderTotal, transactions } = useApp()
  const today = useMemo(() => new Date(), [])

  const monthOptions = useMemo(() => {
    const opts = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      opts.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' }),
      })
    }
    return opts
  }, [today])

  const [type, setType] = useState('daily')
  const [dailyDate, setDailyDate] = useState(() => toDayStr(new Date()))
  const [monthKey, setMonthKey] = useState(monthOptions[0].key)

  // Orders in the selected scope
  const scopeOrders = useMemo(() => {
    if (type === 'daily') {
      return orders.filter((o) => toDayStr(new Date(o.createdAt)) === dailyDate)
    }
    const [y, m] = monthKey.split('-').map(Number)
    return orders.filter((o) => {
      const d = new Date(o.createdAt)
      return d.getFullYear() === y && d.getMonth() === m - 1
    })
  }, [orders, type, dailyDate, monthKey])

  const report = useMemo(() => {
    const totalOrders = scopeOrders.length
    const grossSales = scopeOrders.reduce((s, o) => s + orderTotal(o.items).total, 0)
    const collected = scopeOrders
      .filter((o) => o.payment === 'Paid')
      .reduce((s, o) => s + orderTotal(o.items).total, 0)
    const top = topSelling(scopeOrders)
    const stock = estimateStockUsed(scopeOrders)

    if (type === 'monthly') {
      const [y, m] = monthKey.split('-').map(Number)
      const fig = monthFigures(transactions, y, m - 1, today)
      return {
        title: 'Monthly Report',
        rangeLabel: monthOptions.find((o) => o.key === monthKey)?.label,
        revenueLabel: 'Sales income (ledger)',
        revenue: fig.income,
        expenses: fig.expense,
        payroll: fig.payroll,
        netProfit: fig.profit,
        totalOrders,
        collected,
        top,
        stock,
      }
    }

    // Daily — expenses = transactions logged that day
    const dailyExpenses = transactions
      .filter((tx) => tx.type === 'expense' && toDayStr(new Date(tx.date)) === dailyDate)
      .reduce((s, tx) => s + tx.amount, 0)
    return {
      title: 'Daily Report',
      rangeLabel: new Date(`${dailyDate}T00:00:00`).toLocaleDateString('en-PK', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      revenueLabel: 'Sales (orders placed)',
      revenue: grossSales,
      expenses: dailyExpenses,
      payroll: 0,
      netProfit: grossSales - dailyExpenses,
      totalOrders,
      collected,
      top,
      stock,
    }
  }, [scopeOrders, type, monthKey, dailyDate, transactions, today, orderTotal, monthOptions])

  const shareWhatsApp = () => {
    const lines = [
      `*Dua Restaurant — ${report.title}*`,
      report.rangeLabel,
      '',
      `Orders: ${report.totalOrders}`,
      `${report.revenueLabel}: ${money(report.revenue)}`,
      `Expenses: ${money(report.expenses)}`,
      `Net Profit: ${money(report.netProfit)}`,
    ]
    if (report.top.length) {
      lines.push('', 'Top items:')
      report.top.forEach(([name, qty], i) => lines.push(`${i + 1}. ${name} ×${qty}`))
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle="Daily & monthly summary — printable.">
        <div className="flex flex-wrap items-center gap-2 no-print">
          <div className="flex overflow-hidden rounded-xl border border-ink-line">
            {['daily', 'monthly'].map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-4 py-2 text-sm font-semibold capitalize transition ${
                  type === t ? 'bg-gold/15 text-gold' : 'bg-ink-soft text-cream-dim hover:text-cream'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {type === 'daily' ? (
            <input
              type="date"
              className="input w-44 py-2"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
            />
          ) : (
            <select
              className="input w-44 py-2"
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

      {/* Printable report (light "paper" — matches print output) */}
      <div className="mx-auto max-w-2xl">
        <div id="printable-report" className="rounded-2xl bg-cream p-8 text-ink shadow-lift">
          {/* Brand header */}
          <div className="text-center">
            <div className="font-serif text-3xl font-bold" style={{ color: '#8C6F1A' }}>
              Dua Restaurant
            </div>
            <p className="text-[11px] uppercase tracking-[0.3em]" style={{ color: '#8C6F1A' }}>
              Café Ali
            </p>
            <p className="mt-1 text-[11px] text-neutral-600">Hawksbay Road, Karachi · 021-111-DUA</p>
          </div>

          <div className="my-5 border-t-2 border-dashed border-neutral-400" />

          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-bold text-neutral-900">{report.title}</h2>
            <span className="text-sm font-semibold text-neutral-700">{report.rangeLabel}</span>
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
            Generated {new Date().toLocaleString('en-PK')}
          </p>

          {/* Summary */}
          <div className="mt-5">
            <Row label="Total Orders" value={report.totalOrders} />
            <Row label={report.revenueLabel} value={money(report.revenue)} tone="text-emerald-700" />
            {type === 'daily' && (
              <Row label="Collected (paid)" value={money(report.collected)} tone="text-neutral-700" />
            )}
            {type === 'monthly' && report.payroll > 0 && (
              <Row label="— incl. Staff Payroll" value={money(report.payroll)} tone="text-neutral-700" />
            )}
            <Row label="Expenses" value={money(report.expenses)} tone="text-rose-600" />
            <Row
              label="Net Profit"
              value={money(report.netProfit)}
              tone={report.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}
              strong
            />
          </div>

          {/* Top items */}
          <div className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Top Selling Items</h3>
            {report.top.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">No orders in this period.</p>
            ) : (
              <ol className="mt-2 space-y-1">
                {report.top.map(([name, qty], i) => (
                  <li key={name} className="flex justify-between text-sm text-neutral-800">
                    <span>
                      {i + 1}. {name}
                    </span>
                    <span className="font-semibold">{qty} sold</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Stock used */}
          <div className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
              Estimated Stock Used
            </h3>
            {report.stock.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">No consumption recorded.</p>
            ) : (
              <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                {report.stock.map((s) => (
                  <li key={s.name} className="flex justify-between text-sm text-neutral-800">
                    <span>{s.name}</span>
                    <span className="font-semibold">
                      {s.qty} {s.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="my-5 border-t-2 border-dashed border-neutral-400" />
          <p className="text-center text-[11px] text-neutral-500">
            Dua Restaurant POS · Café Ali — figures in Pakistani Rupees (Rs.)
          </p>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap justify-center gap-3 no-print">
          <button onClick={() => window.print()} className="btn-gold px-5 py-2.5">
            <IconPrint size={18} /> Print / Save PDF
          </button>
          <button onClick={shareWhatsApp} className="btn-ghost px-5 py-2.5">
            <IconWhatsApp size={18} /> Share on WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}
