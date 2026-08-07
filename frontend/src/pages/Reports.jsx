import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT, useLang } from '../i18n/LanguageContext.jsx'
import { itemNameLabel, unitLabel } from '../i18n/dataDict.js'
import { PageHeader } from '../components/ui.jsx'
import { money, monthYear, dateLong, time } from '../utils/format.js'
import KOTView from '../components/KOTView.jsx'
import SessionHistory from '../components/SessionHistory.jsx'
import { monthFigures, isMaintenance } from '../utils/accounting.js'
import { buildSessions, sessionLabel } from '../utils/sessions.js'
import { safePrint } from '../utils/print.js'
import { calculateDeductions } from '../utils/inventoryFlow.js'
import { IconPrint, IconWhatsApp } from '../components/Icons.jsx'
import { CURRENCY } from '../data/mockData.js'
import urDict from '../i18n/ur.json'
import enDict from '../i18n/en.json'

const resolvePath = (dict, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict)
// The WhatsApp share always renders fully in Urdu, independent of the app's
// current display language — matching the backend's automated daily WhatsApp
// report (backend/src/reports/whatsappReport.ts), built per direct client
// feedback that the report must be entirely in Urdu. Numbers stay Latin
// digits throughout (same file's convention), so amounts/dates below are
// formatted with 'en-PK'/'en-US', not the Eastern-Arabic numbering the app's
// own Urdu mode otherwise uses.
const tUr = (key) => resolvePath(urDict, key) ?? resolvePath(enDict, key) ?? key
const rsUr = (n) => `${CURRENCY} ${Number(n || 0).toLocaleString('en-US')}`
const stampUr = (iso) =>
  `${new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}, ${new Date(iso).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}`

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
  const { orders, orderTotal, transactions, staff, inventory, recipes, dailyClosings, lastClosingAt } = useApp()
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

  const [type, setType] = useState('session')
  const [view, setView] = useState('overview') // 'overview' | 'summary' | 'itemwise' | 'kot' | 'history'
  // Which recording window to report on. The business day doesn't follow the
  // calendar (open 2pm, close 3pm the next day), so a report is scoped to the
  // session between two closings — the same boundary the Closing page and the
  // Dashboard already use — not to a date. `sessions[0]` is the open one.
  const [sessionId, setSessionId] = useState('current')
  const [monthKey, setMonthKey] = useState(monthOptions[0].key)

  const sessions = useMemo(
    () => buildSessions(dailyClosings, lastClosingAt),
    [dailyClosings, lastClosingAt],
  )
  // Falls back to the open session when the selected one disappears — e.g. a
  // day gets closed on another device and the list refetches under us.
  const selected = sessions.find((s) => s.id === sessionId) || sessions[0]

  // Orders in the selected scope
  const scopeOrders = useMemo(() => {
    if (type === 'session') {
      return orders.filter((o) => !o.cancelled && selected.contains(o.createdAt))
    }
    const [y, m] = monthKey.split('-').map(Number)
    return orders.filter((o) => {
      if (o.cancelled) return false
      const d = new Date(o.createdAt)
      return d.getFullYear() === y && d.getMonth() === m - 1
    })
  }, [orders, type, selected, monthKey])

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
        // Rounded per line — qty can be a decimal kg weight now, and every
        // money figure shown must stay a whole rupee.
        cur.total += Math.round(it.price * it.qty)
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
      const fig = monthFigures(transactions, orders, orderTotal, y, m - 1, today, staff)
      return {
        titleKey: 'reports.monthlyReport',
        rangeLabel: monthOptions.find((o) => o.key === monthKey)?.label,
        revenueLabelKey: 'reports.salesIncomeLedger',
        revenue: fig.income,
        expenses: fig.expense,
        maintenance: fig.maintenance,
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

    // Session — expenses = transactions logged inside the same recording
    // window as the orders above (maintenance split out)
    const dayExpenses = transactions.filter(
      (tx) => tx.type === 'expense' && selected.contains(tx.date),
    )
    const dailyMaintenance = dayExpenses.filter((tx) => isMaintenance(tx.category)).reduce((s, tx) => s + tx.amount, 0)
    const dailyExpenses = dayExpenses.filter((tx) => !isMaintenance(tx.category)).reduce((s, tx) => s + tx.amount, 0)
    return {
      titleKey: 'reports.sessionReport',
      rangeLabel: sessionLabel(selected, t),
      periodStart: selected.from,
      periodEnd: selected.to,
      // Total Sale = collected (paid) orders only, so it always equals
      // Cash + Card + Online. Unpaid/running tabs are excluded until paid.
      revenueLabelKey: 'reports.totalSaleCollected',
      revenue: collected,
      expenses: dailyExpenses,
      maintenance: dailyMaintenance,
      payroll: 0,
      netProfit: collected - dailyExpenses - dailyMaintenance,
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
  }, [scopeOrders, type, monthKey, selected, transactions, today, orderTotal, monthOptions, staff, inventory, recipes, t])

  const shareWhatsApp = () => {
    // Range label is re-derived here (forced Urdu, Latin digits) rather than
    // reused from `report.rangeLabel`, which was built with the app's
    // currently-active language/digit locale — the two can disagree when the
    // cashier's screen is in English.
    let rangeLabel
    if (type === 'monthly') {
      const [y, m] = monthKey.split('-').map(Number)
      rangeLabel = `${new Date(y, m - 1, 1).toLocaleDateString('ur-PK', { month: 'long' })} ${y}`
    } else if (!selected.from) {
      rangeLabel = selected.open ? tUr('reports.noClosingYet') : `${tUr('reports.upTo')} ${stampUr(selected.to)}`
    } else {
      rangeLabel = `${stampUr(selected.from)} → ${selected.open ? tUr('reports.now') : stampUr(selected.to)}`
    }

    const lines = [
      `*Cafe Ali — ${tUr(report.titleKey)}*`,
      rangeLabel,
      '',
      `${tUr('reports.totalOrders')}: ${report.totalOrders}`,
      `${tUr(report.revenueLabelKey)}: ${rsUr(report.revenue)}`,
    ]
    if (type === 'session') {
      lines.push(
        `${tUr('reports.cash')}: ${rsUr(report.cash)}`,
        `${tUr('reports.card')}: ${rsUr(report.card)}`,
        `${tUr('reports.online')}: ${rsUr(report.online)}`,
      )
      if (report.onlineByAccount?.length) {
        lines.push(`   ${tUr('reports.onlineByAccount')}:`)
        // Account names are free text typed by staff, not translated — same
        // rule the backend report follows (see whatsappReport.ts).
        report.onlineByAccount.forEach(([name, amount]) => lines.push(`   · ${name}: ${rsUr(amount)}`))
      }
    }
    lines.push(
      `${tUr('reports.expenses')}: ${rsUr(report.expenses)}`,
      `${tUr('reports.maintenance')}: ${rsUr(report.maintenance || 0)}`,
      `${tUr('reports.netProfit')}: ${rsUr(report.netProfit)}`,
    )
    if (report.discounts.total > 0) {
      lines.push(`${tUr('reports.discountsGiven')}: ${rsUr(report.discounts.total)} (${report.discounts.count})`)
      if (report.discounts.byReason.length) {
        report.discounts.byReason.forEach(([reason, amount]) => lines.push(`   · ${reason}: ${rsUr(amount)}`))
      }
    }
    if (report.top.length) {
      lines.push('', `${tUr('reports.topSelling')}:`)
      report.top.forEach(([name, qty], i) => lines.push(`${i + 1}. ${itemNameLabel(name, 'ur')} ×${qty}`))
    }
    if (report.items.length) {
      lines.push('', `${tUr('reports.itemWiseSales')}:`)
      report.items.forEach((it) =>
        lines.push(`• ${itemNameLabel(it.name, 'ur')} ×${it.qty} — ${rsUr(it.total)}`),
      )
    }
    if (report.stock.length) {
      lines.push('', `${tUr('reports.estStockUsed')}:`)
      report.stock.forEach((s) =>
        lines.push(`• ${itemNameLabel(s.name, 'ur')}: ${s.qty} ${unitLabel(s.unit, 'ur')}`),
      )
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  // KOT is inherently a single-session report — it uses `selected` and doesn't
  // apply the session/monthly period toggle. History lists every past session,
  // so it has no period scope of its own either.
  const isSessionOnlyView = view === 'kot'
  const isHistoryView = view === 'history'

  return (
    <div>
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')}>
        <div className="flex flex-wrap items-center gap-2 no-print">
          {!isSessionOnlyView && !isHistoryView && (
            <div className="flex overflow-hidden rounded-xl border border-ink-line">
              {['session', 'monthly'].map((p) => (
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
          {isHistoryView ? null : isSessionOnlyView || type === 'session' ? (
            /* Each option is one closing-to-closing recording window, newest
               first, so the period a report covers is always explicit. */
            <select
              className="input w-72 py-2"
              dir="ltr"
              value={selected.id}
              onChange={(e) => setSessionId(e.target.value)}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.open ? `${t('reports.currentSession')} — ` : ''}
                  {sessionLabel(s, t)}
                </option>
              ))}
            </select>
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
          ['overview', 'reports.sessionReport'],
          ['summary', 'reports.summary'],
          ['itemwise', 'reports.itemWise'],
          ['kot', 'nav.kot'],
          ['history', 'reports.history'],
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

      {view === 'kot' && <KOTView session={selected} />}

      {isHistoryView && (
        <SessionHistory
          sessions={sessions}
          onView={(id) => {
            setSessionId(id)
            setType('session')
            setView('overview')
          }}
        />
      )}

      {!isSessionOnlyView && !isHistoryView && (
      <div className="mx-auto max-w-2xl">
        {/* Printable report (light "paper" — matches print output). Session
            Report, Summary and Item-Wise all share this one surface, toggling
            content by `view`, so the three tabs look and print consistently
            instead of each inventing its own layout. */}
        <div id="printable-report" className="rounded-2xl bg-white p-8 text-[#3E2723] shadow-lift border border-[#E8DCC4]">
          {/* Brand header */}
          <div className="text-center">
            <div className="font-serif text-3xl font-bold" style={{ color: '#C9A961' }}>
              Cafe Ali
            </div>
            <p className="mt-1 text-[11px] text-[#5D4037]">Hawksbay Road, Karachi · 021-111-ALI</p>
          </div>

          <div className="my-5 border-t-2 border-dashed border-[#E8DCC4]" />

          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-xl font-bold text-[#C9A961]">{t(report.titleKey)}</h2>
            <span className="text-right text-sm font-semibold text-[#5D4037]" dir="ltr">
              {report.rangeLabel}
            </span>
          </div>
          {/* Printed copies must state the exact window they cover — a sheet
              that only says "26 Jul" hides the half of the session that ran on
              the 25th. */}
          {type === 'session' && (
            <p className="mt-1 text-[11px] font-semibold text-[#5D4037]" dir="ltr">
              {t('reports.recordingPeriod')}: {report.rangeLabel}
            </p>
          )}
          <p className="mt-1 text-[11px] text-[#8D6E63]">
            {t('reports.generated')} {dateLong()} · {time(new Date().toISOString())}
          </p>

          {view === 'overview' && (
            <div className="mt-5">
              <Row label={t('reports.totalOrders')} value={report.totalOrders} tone="text-[#3498DB]" />
              <Row label={t(report.revenueLabelKey)} value={money(report.revenue)} tone="text-[#3498DB]" />
              {type === 'session' && (
                <>
                  <Row label={t('reports.cash')} value={money(report.cash)} tone="text-[#3498DB]" />
                  <Row label={t('reports.card')} value={money(report.card)} tone="text-[#3498DB]" />
                  <Row label={t('reports.online')} value={money(report.online)} tone="text-[#3498DB]" />
                  {/* Per-account online reconciliation — which wallet/bank each
                      online payment landed in, so totals can be matched
                      against statements. */}
                  {report.onlineByAccount?.map(([name, amount]) => (
                    <div key={name} className="flex items-center justify-between py-1 pl-7 text-xs text-[#8D6E63]">
                      <span>· {name}</span>
                      <span className="font-semibold text-[#3498DB]">{money(amount)}</span>
                    </div>
                  ))}
                </>
              )}
              <Row label={t('reports.expenses')} value={money(report.expenses)} tone="text-[#E74C3C]" />
              <Row label={t('reports.maintenance')} value={money(report.maintenance || 0)} tone="text-[#E67E22]" />
              <Row
                label={t('reports.netProfit')}
                value={money(report.netProfit)}
                tone={report.netProfit >= 0 ? 'text-[#27AE60]' : 'text-[#E74C3C]'}
                strong
              />
            </div>
          )}

          {view === 'summary' && (
          <>
          {/* Summary */}
          <div className="mt-5">
            <Row label={t('reports.totalOrders')} value={report.totalOrders} tone="text-[#3498DB]" />
            <Row label={t(report.revenueLabelKey)} value={money(report.revenue)} tone="text-[#3498DB]" />
            {type === 'session' && (
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
            <Row label={t('reports.maintenance')} value={money(report.maintenance || 0)} tone="text-[#E67E22]" />
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
      </div>
      )}
    </div>
  )
}
