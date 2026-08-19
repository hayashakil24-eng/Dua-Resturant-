import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT, useLang } from '../i18n/LanguageContext.jsx'
import { itemNameLabel, unitLabel } from '../i18n/dataDict.js'
import { PageHeader } from '../components/ui.jsx'
import { money, monthYear, dateLong, dateShort, time } from '../utils/format.js'
import KOTView from '../components/KOTView.jsx'
import SessionHistory from '../components/SessionHistory.jsx'
import { monthFigures, isMaintenance } from '../utils/accounting.js'
import { buildSessions, sessionLabel } from '../utils/sessions.js'
import { buildClosingReport, toDayStr } from '../utils/closing.js'
import { printReportDialog } from '../utils/print.js'
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

// One Daily Ledger section — a titled table matching this page's existing
// Item-Wise table styling, or an empty-state line when there's nothing to
// show (e.g. no open receivables). `total`/`totalLabel` are omitted when
// there are no rows, same as the rest of this page's sections.
function LedgerTable({ title, subtitle, columns, rows, empty, totalLabel, total, renderRow }) {
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wide text-[#3E2723]/90">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-[#8D6E63]">{subtitle}</p>}
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-[#8D6E63]">{empty}</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#E8DCC4] text-left text-[11px] uppercase tracking-wide text-[#8D6E63]">
              {columns.map((c, i) => (
                <th key={c} className={`py-2 font-semibold ${i === columns.length - 1 ? 'text-right' : ''}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(renderRow)}
            <tr className="border-t-2 border-[#E8DCC4] font-bold">
              <td colSpan={columns.length - 1} className="py-2 text-[#3E2723]">
                {totalLabel}
              </td>
              <td className="py-2 text-right text-[#3498DB]">{money(total)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
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
  const { orders, orderTotal, transactions, staff, inventory, recipes, dailyClosings, lastClosingAt, purchases, receivables, advances } = useApp()
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

  // Daily Ledger tab — Maintenance/Receivables/Advance Salary/Complimentary/
  // Credit Settlement, reusing buildClosingReport (the same function Closing.jsx
  // uses, and that backend/src/core/closing.ts saves into DailyClosing at close
  // time) rather than recomputing this data a third way. A CLOSED session
  // already has this exact output frozen in `selected.record` (spread onto the
  // row by closing.service.ts's listClosings()) — reuse it directly instead of
  // rebuilding, so a past session's Receivables/Advances reflect what was open
  // AT THAT TIME, not live-today data. Only the still-open current session has
  // no record yet, so that one is computed live.
  const ledgerReport = useMemo(() => {
    if (selected.record) return selected.record
    return buildClosingReport(
      orders,
      orderTotal,
      transactions,
      toDayStr(new Date()),
      inventory,
      recipes,
      selected.from,
      purchases,
      receivables,
      advances,
      staff,
    )
  }, [selected, orders, orderTotal, transactions, inventory, recipes, purchases, receivables, advances, staff])

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
  // so it has no period scope of its own either. Daily Ledger (Maintenance/
  // Receivables/Advance Salary/Complimentary/Credit Settlement) is likewise
  // always session-scoped — "this session's activity" or "the balance as of
  // that session's close", never a calendar month — so it shares KOT's forced
  // session-scope, just not KOT's separate full-page view.
  const forcesSessionScope = view === 'kot' || view === 'ledger'
  const isHistoryView = view === 'history'
  const hidesPrintableCard = view === 'kot' || isHistoryView

  return (
    <div>
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')}>
        <div className="flex flex-wrap items-center gap-2 no-print">
          {!forcesSessionScope && !isHistoryView && (
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
          {isHistoryView ? null : forcesSessionScope || type === 'session' ? (
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
          ['ledger', 'reports.dailyLedger'],
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

      {!hidesPrintableCard && (
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
            <p className="mt-1 text-[11px] text-[#5D4037]">Main Hawksbay Beach, Zulfiqar Chowrangi, Maripur Road, Karachi · 0313-2870111</p>
          </div>

          <div className="my-5 border-t-2 border-dashed border-[#E8DCC4]" />

          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-xl font-bold text-[#C9A961]">
              {view === 'ledger' ? t('reports.dailyLedger') : t(report.titleKey)}
            </h2>
            <span className="text-right text-sm font-semibold text-[#5D4037]" dir="ltr">
              {view === 'ledger' ? sessionLabel(selected, t) : report.rangeLabel}
            </span>
          </div>
          {/* Printed copies must state the exact window they cover — a sheet
              that only says "26 Jul" hides the half of the session that ran on
              the 25th. Daily Ledger is always session-scoped (forcesSessionScope),
              so it always gets this line, independent of the `type` toggle's
              last-selected value. */}
          {(view === 'ledger' || type === 'session') && (
            <p className="mt-1 text-[11px] font-semibold text-[#5D4037]" dir="ltr">
              {t('reports.recordingPeriod')}: {view === 'ledger' ? sessionLabel(selected, t) : report.rangeLabel}
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

          {/* Daily Ledger — Maintenance itemization, Receivables/Udhaar grand
              total (with advance-against-dues netting), Advance Salary, and,
              separately, Complimentary Orders and Credit Purchase Settlement.
              All sourced from ledgerReport (buildClosingReport), matching the
              Day Closing sheet's own underlying data. */}
          {view === 'ledger' && (
            <div className="mt-5 space-y-6">
              {/* Per-account online payments — the admin-configured accounts
                  (OnlineAccount model, e.g. JazzCash/Easypaisa; see Settings)
                  each order's onlineAccountName is snapshotted against.
                  ledgerReport.onlineByAccount already computes this exact
                  breakdown (buildClosingReport, same source as the combined
                  "Online" total on the Session Report tab) — not a new field. */}
              <LedgerTable
                title={t('reports.ledgerOnlineBreakdown')}
                columns={[t('reports.colAccount'), t('reports.colRevenue')]}
                rows={ledgerReport.onlineByAccount || []}
                empty={t('reports.noOnlinePayments')}
                totalLabel={t('reports.onlineTotal')}
                total={ledgerReport.online}
                renderRow={([name, amount]) => (
                  <tr key={name} className="border-b border-[#E8DCC4]/50">
                    <td className="py-2 text-[#3E2723]">{name}</td>
                    <td className="py-2 text-right font-semibold text-[#3498DB]">{money(amount)}</td>
                  </tr>
                )}
              />

              <LedgerTable
                title={t('reports.ledgerMaintenance')}
                columns={[t('reports.date'), t('reports.colType'), t('reports.colVendor'), t('reports.colDescription'), t('reports.colRevenue')]}
                rows={ledgerReport.maintenanceItems || []}
                empty={t('reports.noMaintenanceItems')}
                totalLabel={t('reports.maintenanceTotal')}
                total={ledgerReport.maintenanceTotal}
                renderRow={(m, i) => (
                  <tr key={i} className="border-b border-[#E8DCC4]/50">
                    <td className="py-2 text-[#3E2723]">{dateShort(m.date)}</td>
                    <td className="py-2 text-[#3E2723]">{m.subCategory ? m.subCategory[0].toUpperCase() + m.subCategory.slice(1) : '-'}</td>
                    <td className="py-2 text-[#3E2723]">{m.vendor || '-'}</td>
                    <td className="py-2 text-[#3E2723]">{m.description || '-'}</td>
                    <td className="py-2 text-right font-semibold text-[#3498DB]">{money(m.amount)}</td>
                  </tr>
                )}
              />

              <LedgerTable
                title={t('reports.ledgerReceivables')}
                columns={[t('reports.colAccount'), t('reports.colType'), t('reports.colAdvanceAgainstDues'), t('reports.colBalance')]}
                rows={ledgerReport.openReceivables || []}
                empty={t('reports.noReceivablesOpen')}
                totalLabel={t('reports.grandTotalReceivables')}
                total={ledgerReport.receivablesTotal}
                renderRow={(r) => (
                  <tr key={r.name} className="border-b border-[#E8DCC4]/50">
                    <td className="py-2 text-[#3E2723]">{r.name}</td>
                    <td className="py-2 text-[#3E2723]">{r.type ? r.type[0].toUpperCase() + r.type.slice(1) : '-'}</td>
                    <td className="py-2 text-right text-[#8D6E63]">{r.advanceAgainstDues > 0 ? money(r.advanceAgainstDues) : '-'}</td>
                    <td className="py-2 text-right font-semibold text-[#3498DB]">{money(r.balance)}</td>
                  </tr>
                )}
              />

              <LedgerTable
                title={t('reports.ledgerAdvances')}
                columns={[t('reports.colStaff'), t('reports.colRole'), t('reports.colDateGiven'), t('reports.colDeductFrom'), t('reports.colStatus'), t('reports.colRevenue')]}
                rows={ledgerReport.openAdvances || []}
                empty={t('reports.noAdvancesOpen')}
                totalLabel={t('reports.totalAdvancesLedger')}
                total={ledgerReport.advancesTotal}
                renderRow={(a, i) => (
                  <tr key={i} className="border-b border-[#E8DCC4]/50">
                    <td className="py-2 text-[#3E2723]">{a.staffName}</td>
                    <td className="py-2 text-[#3E2723]">{a.role || '-'}</td>
                    <td className="py-2 text-[#3E2723]">{dateShort(a.date)}</td>
                    <td className="py-2 text-[#3E2723]">{a.deductFromSalaryDate ? dateShort(a.deductFromSalaryDate) : '-'}</td>
                    <td className="py-2 text-[#3E2723]">{a.status === 'recovered' ? t('reports.statusSettled') : t('reports.statusActive')}</td>
                    <td className="py-2 text-right font-semibold text-[#3498DB]">{money(a.amount)}</td>
                  </tr>
                )}
              />

              <LedgerTable
                title={t('reports.ledgerComplimentary')}
                subtitle={t('reports.notCountedNetSale')}
                columns={[t('reports.colRecipient'), t('reports.colDescription'), t('reports.colRevenue')]}
                rows={ledgerReport.complimentaryItems || []}
                empty={t('reports.noComplimentaryOrders')}
                totalLabel={t('reports.complimentaryTotal')}
                total={ledgerReport.complimentaryTotal}
                renderRow={(c, i) => (
                  <tr key={i} className="border-b border-[#E8DCC4]/50">
                    <td className="py-2 text-[#3E2723]">{c.name}</td>
                    <td className="py-2 text-[#3E2723]">{c.description}</td>
                    <td className="py-2 text-right font-semibold text-[#3498DB]">{money(c.amount)}</td>
                  </tr>
                )}
              />

              {ledgerReport.supplierPayments > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[#3E2723]/90">
                    {t('reports.ledgerCreditSettlement')}
                  </h3>
                  <p className="mt-0.5 text-xs text-[#8D6E63]">{t('reports.creditSettlementNote')}</p>
                  <Row label={t('reports.ledgerCreditSettlement')} value={money(ledgerReport.supplierPayments)} tone="text-[#3498DB]" strong />
                </div>
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
          <button onClick={() => printReportDialog('print-report')} className="btn-gold px-5 py-2.5">
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
