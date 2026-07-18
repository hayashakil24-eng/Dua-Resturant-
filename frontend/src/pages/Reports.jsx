import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT, useLang } from '../i18n/LanguageContext.jsx'
import { itemNameLabel, unitLabel } from '../i18n/dataDict.js'
import { PageHeader } from '../components/ui.jsx'
import { money, monthYear, dateLong, time } from '../utils/format.js'
import DailyClosingView from '../components/DailyClosingView.jsx'
import KOTView from '../components/KOTView.jsx'
import DailyReportSlip from '../components/DailyReportSlip.jsx'
import { monthFigures } from '../utils/accounting.js'
import { safePrint } from '../utils/print.js'
import { calculateDeductions } from '../utils/inventoryFlow.js'
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

// Estimated ingredient consumption from the period's orders, via the same
// approved-recipe deductions that actually drove inventory during the period
// (calculateDeductions — see inventoryFlow.js). Previously this read a
// separate, hand-maintained RECIPE_MAP keyed by an old menu's item ids that no
// longer match INITIAL_MENU, so it silently showed "no consumption" for every
// real order — items without an approved recipe still contribute nothing,
// same as live deduction.
function estimateStockUsed(orderList, inventory, recipes) {
  const allItems = orderList.flatMap((o) => o.items)
  const deductions = calculateDeductions(allItems, inventory, recipes)
  return Object.values(deductions)
    .map((d) => ({ name: d.itemName, qty: Math.round(d.amount * 10) / 10, unit: d.unit }))
    .sort((a, b) => b.qty - a.qty)
}

function Row({ label, value, tone = 'text-[#3498DB]', strong }) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${
        strong ? 'mt-1 border-t-2 border-[#E8DCC4] pt-2.5' : ''
      }`}
    >
      <span className={`${strong ? 'text-sm font-bold' : 'text-sm'} text-[#3E2723]`}>
        {label}
      </span>
      <span className={`${strong ? 'text-xl font-bold' : 'text-sm font-semibold'} ${tone}`}>
        {value}
      </span>
    </div>
  )
}

export default function Reports() {
  const { orders, orderTotal, transactions, staff, inventory, recipes } = useApp()
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

  const [type, setType] = useState('daily')
  const [view, setView] = useState('overview') // 'overview' | 'summary' | 'itemwise'
  const [dailyDate, setDailyDate] = useState(() => toDayStr(new Date()))
  const [monthKey, setMonthKey] = useState(monthOptions[0].key)

  // Earliest selectable day — reports retain the last 6 months of history.
  const minDay = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate())
    return toDayStr(d)
  }, [today])
  const maxDay = useMemo(() => toDayStr(today), [today])

  // Orders in the selected scope
  const scopeOrders = useMemo(() => {
    if (type === 'daily') {
      return orders.filter((o) => !o.cancelled && toDayStr(new Date(o.createdAt)) === dailyDate)
    }
    const [y, m] = monthKey.split('-').map(Number)
    return orders.filter((o) => {
      if (o.cancelled) return false
      const d = new Date(o.createdAt)
      return d.getFullYear() === y && d.getMonth() === m - 1
    })
  }, [orders, type, dailyDate, monthKey])

  const report = useMemo(() => {
    const totalOrders = scopeOrders.length
    const paidOrders = scopeOrders.filter((o) => o.payment === 'Paid')
    const collected = paidOrders.reduce(
      (s, o) => s + orderTotal(o.items, o.discount?.amount, o.gstRate).total,
      0,
    )
    // Payment-method split — collected (paid) orders only. Cash + Card + Online
    // always equals the collected total.
    const cash = paidOrders
      .filter((o) => o.method === 'Cash')
      .reduce((s, o) => s + orderTotal(o.items, o.discount?.amount, o.gstRate).total, 0)
    const card = paidOrders
      .filter((o) => o.method === 'Card')
      .reduce((s, o) => s + orderTotal(o.items, o.discount?.amount, o.gstRate).total, 0)
    const onlineOrders = paidOrders.filter((o) => o.method === 'Online')
    const online = onlineOrders.reduce(
      (s, o) => s + orderTotal(o.items, o.discount?.amount, o.gstRate).total,
      0,
    )
    // Per-account split of online sales, for daily reconciliation of each
    // wallet/bank account. Keyed by the snapshotted account name on the order.
    const onlineByAccount = Object.entries(
      onlineOrders.reduce((acc, o) => {
        const key = o.onlineAccountName || 'Unspecified'
        acc[key] = (acc[key] || 0) + orderTotal(o.items, o.discount?.amount, o.gstRate).total
        return acc
      }, {}),
    ).sort((a, b) => b[1] - a[1])
    const top = topSelling(scopeOrders)
    const stock = estimateStockUsed(scopeOrders, inventory, recipes)

    // Full item-wise breakdown — every item sold in the scope, qty + revenue.
    const itemMap = {}
    scopeOrders.forEach((o) =>
      o.items.forEach((it) => {
        const cur = itemMap[it.name] || { name: it.name, qty: 0, total: 0 }
        cur.qty += it.qty
        cur.total += it.price * it.qty
        itemMap[it.name] = cur
      }),
    )
    const items = Object.values(itemMap).sort((a, b) => b.total - a.total)

    // Discount summary — count, total given, and breakdown by reason.
    const discountOrders = scopeOrders.filter((o) => o.discount)
    const discounts = {
      count: discountOrders.length,
      total: discountOrders.reduce((s, o) => s + o.discount.amount, 0),
      byReason: Object.entries(
        discountOrders.reduce((acc, o) => {
          const r = o.discount.reason || 'Other'
          acc[r] = (acc[r] || 0) + o.discount.amount
          return acc
        }, {}),
      ).sort((a, b) => b[1] - a[1]),
    }

    if (type === 'monthly') {
      const [y, m] = monthKey.split('-').map(Number)
      const fig = monthFigures(transactions, y, m - 1, today, staff)
      return {
        titleKey: 'reports.monthlyReport',
        rangeLabel: monthOptions.find((o) => o.key === monthKey)?.label,
        revenueLabelKey: 'reports.salesIncomeLedger',
        revenue: fig.income,
        expenses: fig.expense,
        payroll: fig.payroll,
        netProfit: fig.profit,
        totalOrders,
        collected,
        cash,
        card,
        top,
        stock,
        items,
        discounts,
      }
    }

    // Daily — expenses = transactions logged that day
    const dailyExpenses = transactions
      .filter((tx) => tx.type === 'expense' && toDayStr(new Date(tx.date)) === dailyDate)
      .reduce((s, tx) => s + tx.amount, 0)
    return {
      titleKey: 'reports.dailyReport',
      rangeLabel: dateLong(`${dailyDate}T00:00:00`),
      // Total Sale = collected (paid) orders only, so it always equals
      // Cash + Card + Online. Unpaid/running tabs are excluded until paid.
      revenueLabelKey: 'reports.totalSaleCollected',
      revenue: collected,
      expenses: dailyExpenses,
      payroll: 0,
      netProfit: collected - dailyExpenses,
      totalOrders,
      collected,
      cash,
      card,
      online,
      onlineByAccount,
      top,
      stock,
      items,
      discounts,
    }
  }, [scopeOrders, type, monthKey, dailyDate, transactions, today, orderTotal, monthOptions, staff, inventory, recipes])

  const shareWhatsApp = () => {
    const lines = [
      `*Cafe Ali — ${t(report.titleKey)}*`,
      report.rangeLabel,
      '',
      `${t('reports.totalOrders')}: ${report.totalOrders}`,
      `${t(report.revenueLabelKey)}: ${money(report.revenue)}`,
      `${t('reports.expenses')}: ${money(report.expenses)}`,
      `${t('reports.netProfit')}: ${money(report.netProfit)}`,
    ]
    if (report.discounts.total > 0) {
      lines.push(
        `${t('reports.discountsGiven')}: ${money(report.discounts.total)} (${report.discounts.count})`,
      )
    }
    if (report.top.length) {
      lines.push('', `${t('reports.topSelling')}:`)
      report.top.forEach(([name, qty], i) => lines.push(`${i + 1}. ${name} ×${qty}`))
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  // Daily Closing & KOT are inherently daily reports — they use `dailyDate` and
  // don't apply the daily/monthly period toggle.
  const isDailyView = view === 'dailyclosing' || view === 'kot'

  return (
    <div>
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')}>
        <div className="flex flex-wrap items-center gap-2 no-print">
          {!isDailyView && (
            <div className="flex overflow-hidden rounded-xl border border-ink-line">
              {['daily', 'monthly'].map((p) => (
                <button
                  key={p}
                  onClick={() => setType(p)}
                  className={`px-4 py-2 text-sm font-semibold transition ${
                    type === p ? 'bg-gold/15 text-gold' : 'bg-ink-soft text-cream-dim hover:text-cream'
                  }`}
                >
                  {t(`reports.${p}`)}
                </button>
              ))}
            </div>
          )}
          {isDailyView || type === 'daily' ? (
            <input
              type="date"
              className="input w-44 py-2"
              value={dailyDate}
              min={minDay}
              max={maxDay}
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

      {/* View tabs */}
      <div className="mb-4 flex flex-wrap gap-2 border-b border-ink-line no-print">
        {[
          ['overview', 'reports.dailyReport'],
          ['summary', 'reports.summary'],
          ['itemwise', 'reports.itemWise'],
          ['dailyclosing', 'nav.dailyClosing'],
          ['kot', 'nav.kot'],
        ].map(([key, labelKey]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
              view === key
                ? 'border-gold text-gold'
                : 'border-transparent text-cream-dim hover:text-cream'
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {view === 'dailyclosing' && <DailyClosingView dayStr={dailyDate} />}
      {view === 'kot' && <KOTView dayStr={dailyDate} />}

      {!isDailyView && (
      <div className="mx-auto max-w-2xl">
        {/* Daily Report — a clean, at-a-glance overview (screen view, not the
            printable paper). Uses the app's real figures incl. net profit. */}
        {view === 'overview' && (
          <div className="space-y-4">
            <div className="flex justify-end no-print">
              <button onClick={() => safePrint('print-daily')} className="btn-gold px-4 py-2 text-sm">
                <IconPrint size={16} /> {t('reports.printSlip', 'Print')}
              </button>
            </div>

            <DailyReportSlip report={report} />

            <div className="card flex items-center justify-between p-5">
              <span className="text-sm text-cream-dim">{t('reports.date')}</span>
              <span className="font-serif text-lg font-semibold text-gold">{report.rangeLabel}</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card p-6">
                <p className="text-xs uppercase tracking-widest text-cream-dim">{t('reports.totalOrders')}</p>
                <p className="mt-2 font-serif text-4xl font-semibold text-cream">{report.totalOrders}</p>
              </div>
              <div className="card p-6">
                <p className="text-xs uppercase tracking-widest text-cream-dim">{t(report.revenueLabelKey)}</p>
                <p className="mt-2 font-serif text-4xl font-semibold text-gold">{money(report.revenue)}</p>
              </div>
              <div className="card border border-emerald-500/25 bg-emerald-500/[0.06] p-6">
                <p className="text-xs uppercase tracking-widest text-emerald-300/80">💵 {t('reports.cashPayment')}</p>
                <p className="mt-2 font-serif text-3xl font-semibold text-emerald-300">{money(report.cash)}</p>
              </div>
              <div className="card border border-sky-500/25 bg-sky-500/[0.06] p-6">
                <p className="text-xs uppercase tracking-widest text-sky-300/80">💳 {t('reports.cardPayment')}</p>
                <p className="mt-2 font-serif text-3xl font-semibold text-sky-300">{money(report.card)}</p>
              </div>
              <div className="card border border-indigo-500/25 bg-indigo-500/[0.06] p-6">
                <p className="text-xs uppercase tracking-widest text-indigo-300/80">🌐 {t('reports.onlinePayment')}</p>
                <p className="mt-2 font-serif text-3xl font-semibold text-indigo-300">{money(report.online)}</p>
              </div>
            </div>

            {/* Online reconciliation — how much landed in each account, so the
                totals can be matched against each wallet/bank statement. */}
            {report.onlineByAccount?.length > 0 && (
              <div className="card border border-indigo-500/25 bg-indigo-500/[0.04] p-6">
                <p className="text-xs uppercase tracking-widest text-indigo-300/80">
                  🌐 {t('reports.onlineByAccount', 'Online — received by account')}
                </p>
                <ul className="mt-4 divide-y divide-ink-line">
                  {report.onlineByAccount.map(([name, amount]) => (
                    <li key={name} className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-cream">{name}</span>
                      <span className="font-serif text-lg font-semibold text-indigo-300">
                        {money(amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card border border-gold/30 bg-gold/[0.06] p-6">
              <p className="text-xs uppercase tracking-widest text-gold">{t('reports.totalProfit')}</p>
              <p
                className={`mt-2 font-serif text-4xl font-semibold ${
                  report.netProfit >= 0 ? 'text-gold' : 'text-rose-300'
                }`}
              >
                {money(report.netProfit)}
              </p>
            </div>

            {report.totalOrders === 0 && (
              <div className="card p-8 text-center text-sm text-cream-dim">
                {t('reports.noOrdersPeriod')}
              </div>
            )}
          </div>
        )}

        {view !== 'overview' && (
        <>
        {/* Printable report (light "paper" — matches print output) */}
        <div id="printable-report" className="rounded-2xl bg-white p-8 text-[#3E2723] shadow-lift border border-[#E8DCC4]">
          {/* Brand header */}
          <div className="text-center">
            <div className="font-serif text-3xl font-bold" style={{ color: '#C9A961' }}>
              Cafe Ali
            </div>
            <p className="mt-1 text-[11px] text-[#5D4037]">Hawksbay Road, Karachi · 021-111-ALI</p>
          </div>

          <div className="my-5 border-t-2 border-dashed border-[#E8DCC4]" />

          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-xl font-bold text-[#C9A961]">{t(report.titleKey)}</h2>
            <span className="text-sm font-semibold text-[#5D4037]">{report.rangeLabel}</span>
          </div>
          <p className="mt-1 text-[11px] text-[#8D6E63]">
            {t('reports.generated')} {dateLong()} · {time(new Date().toISOString())}
          </p>

          {view === 'summary' && (
          <>
          {/* Summary */}
          <div className="mt-5">
            <Row label={t('reports.totalOrders')} value={report.totalOrders} tone="text-[#3498DB]" />
            <Row label={t(report.revenueLabelKey)} value={money(report.revenue)} tone="text-[#3498DB]" />
            {type === 'daily' && (
              <>
                <Row label={t('reports.cash')} value={money(report.cash)} tone="text-[#3498DB]" />
                <Row label={t('reports.card')} value={money(report.card)} tone="text-[#3498DB]" />
                <Row label={t('reports.online')} value={money(report.online)} tone="text-[#3498DB]" />
              </>
            )}
            {type === 'monthly' && report.payroll > 0 && (
              <Row label={t('reports.inclPayroll')} value={money(report.payroll)} tone="text-[#3498DB]" />
            )}
            <Row label={t('reports.expenses')} value={money(report.expenses)} tone="text-[#E74C3C]" />
            <Row
              label={t('reports.netProfit')}
              value={money(report.netProfit)}
              tone={report.netProfit >= 0 ? 'text-[#27AE60]' : 'text-[#E74C3C]'}
              strong
            />
          </div>

          {/* Top items */}
          <div className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#3E2723]/90">{t('reports.topSelling')}</h3>
            {report.top.length === 0 ? (
              <p className="mt-2 text-sm text-[#8D6E63]">{t('reports.noOrdersPeriod')}</p>
            ) : (
              <ol className="mt-2 space-y-1">
                {report.top.map(([name, qty], i) => (
                  <li key={name} className="flex justify-between text-sm text-[#3E2723]">
                    <span>
                      {i + 1}. {name}
                    </span>
                    <span className="font-semibold text-[#3498DB]">{qty} {t('reports.sold')}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Discounts given */}
          <div className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#3E2723]/90">
              {t('reports.discountsGiven')}
            </h3>
            {report.discounts.count === 0 ? (
              <p className="mt-2 text-sm text-[#8D6E63]">{t('reports.noDiscounts')}</p>
            ) : (
              <>
                <div className="mt-2 grid grid-cols-2 gap-x-6">
                  <Row label={t('reports.ordersDiscounted')} value={report.discounts.count} tone="text-[#3498DB]" />
                  <Row
                    label={t('reports.totalDiscount')}
                    value={money(report.discounts.total)}
                    tone="text-[#E74C3C]"
                  />
                </div>
                <ul className="mt-1 space-y-1">
                  {report.discounts.byReason.map(([reason, amount]) => (
                    <li key={reason} className="flex justify-between text-sm text-[#3E2723]">
                      <span>{reason}</span>
                      <span className="font-semibold text-[#3498DB]">{money(amount)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Stock used */}
          <div className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#3E2723]/90">
              {t('reports.estStockUsed')}
            </h3>
            {report.stock.length === 0 ? (
              <p className="mt-2 text-sm text-[#8D6E63]">{t('reports.noConsumption')}</p>
            ) : (
              <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                {report.stock.map((s) => (
                  <li key={s.name} className="flex justify-between text-sm text-[#3E2723]">
                    <span>{itemNameLabel(s.name, lang)}</span>
                    <span className="font-semibold text-[#3498DB]">
                      {s.qty} {unitLabel(s.unit, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          </>
          )}

          {/* Item-Wise breakdown */}
          {view === 'itemwise' && (
            <div className="mt-5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#3E2723]/90">
                {t('reports.itemWiseSales')}
              </h3>
              {report.items.length === 0 ? (
                <p className="mt-2 text-sm text-[#8D6E63]">{t('reports.noItemsSold')}</p>
              ) : (
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-[#E8DCC4] text-left text-[11px] uppercase tracking-wide text-[#8D6E63]">
                      <th className="py-2 font-semibold">{t('reports.colItem')}</th>
                      <th className="py-2 text-center font-semibold">{t('reports.colQtySold')}</th>
                      <th className="py-2 text-right font-semibold">{t('reports.colRevenue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.items.map((it) => (
                      <tr key={it.name} className="border-b border-[#E8DCC4]/50">
                        <td className="py-2 text-[#3E2723]">{itemNameLabel(it.name, lang)}</td>
                        <td className="py-2 text-center text-[#3498DB]">{it.qty}</td>
                        <td className="py-2 text-right font-semibold text-[#3498DB]">
                          {money(it.total)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-[#E8DCC4] font-bold">
                      <td className="py-2 text-[#3E2723]">{t('reports.total')}</td>
                      <td className="py-2 text-center text-[#3498DB]">
                        {report.items.reduce((s, it) => s + it.qty, 0)}
                      </td>
                      <td className="py-2 text-right text-[#3498DB]">
                        {money(report.items.reduce((s, it) => s + it.total, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )}

          <div className="my-5 border-t-2 border-dashed border-[#E8DCC4]" />
          <p className="text-center text-[11px] text-[#8D6E63]">
            {t('reports.footer')}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap justify-center gap-3 no-print">
          <button onClick={() => safePrint('print-report')} className="btn-gold px-5 py-2.5">
            <IconPrint size={18} /> {t('reports.printPdf')}
          </button>
          <button onClick={shareWhatsApp} className="btn-ghost px-5 py-2.5">
            <IconWhatsApp size={18} /> {t('reports.shareWhatsApp')}
          </button>
        </div>
        </>
        )}
      </div>
      )}
    </div>
  )
}
