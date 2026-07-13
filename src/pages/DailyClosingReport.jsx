import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { PageHeader } from '../components/ui.jsx'
import { money, dateLong } from '../utils/format.js'
import { safePrint } from '../utils/print.js'
import { IconPrint } from '../components/Icons.jsx'

const toDayStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function Section({ id, title, tone, open, onToggle, children }) {
  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 transition ${tone}`}
      >
        <h3 className="font-serif text-lg font-semibold">{title}</h3>
        <span className="text-sm">{open ? '▼' : '▶'}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

function Line({ label, value, tone = 'text-cream', strong, border }) {
  return (
    <div className={`flex items-center justify-between py-2 ${border ? 'border-t border-ink-line' : ''}`}>
      <span className={strong ? 'font-semibold text-cream' : 'text-sm text-cream-dim'}>{label}</span>
      <span className={`${strong ? 'font-serif text-xl font-semibold' : 'text-sm font-semibold'} ${tone}`}>
        {value}
      </span>
    </div>
  )
}

export default function DailyClosingReport() {
  const { orders, orderTotal, transactions, receivables, shiftReconciliations } = useApp()
  const t = useT()
  const [dayStr, setDayStr] = useState(() => toDayStr(new Date()))
  const [openSec, setOpenSec] = useState({ revenue: true, receivables: true, expenses: true, settlement: true })
  const toggle = (k) => setOpenSec((p) => ({ ...p, [k]: !p[k] }))

  const data = useMemo(() => {
    const dayOrders = orders.filter((o) => !o.cancelled && toDayStr(new Date(o.createdAt)) === dayStr)
    const grossSale = dayOrders.reduce((s, o) => s + orderTotal(o.items).total, 0)
    const discount = dayOrders.reduce((s, o) => s + (o.discount?.amount || 0), 0)
    const netSale = grossSale - discount

    const paid = dayOrders.filter((o) => o.payment === 'Paid')
    const byMethod = (m) =>
      paid.filter((o) => o.method === m).reduce((s, o) => s + orderTotal(o.items, o.discount?.amount).total, 0)
    const cash = byMethod('Cash')
    const card = byMethod('Card')
    const online = byMethod('Online')
    const netCashSales = cash + card + online

    const openReceivables = receivables.filter((r) => r.status === 'open')
    const totalReceivable = openReceivables.reduce((s, r) => s + r.balance, 0)

    // Expenses from the ledger for this day, grouped by category.
    const expenseTxns = transactions.filter(
      (tx) => tx.type === 'expense' && toDayStr(new Date(tx.date)) === dayStr,
    )
    const expenseByCat = Object.entries(
      expenseTxns.reduce((acc, tx) => {
        acc[tx.category] = (acc[tx.category] || 0) + tx.amount
        return acc
      }, {}),
    ).sort((a, b) => b[1] - a[1])
    const totalExpenses = expenseTxns.reduce((s, tx) => s + tx.amount, 0)

    // Settlement — reconcile against the day's closed shift if there is one.
    const closedShift = shiftReconciliations.find(
      (s) => s.actualCash != null && toDayStr(new Date(s.shiftEndTime || s.shiftStartTime)) === dayStr,
    )
    const expectedCash = closedShift ? closedShift.expectedCash : cash
    const actualCash = closedShift ? closedShift.actualCash : cash
    const variance = actualCash - expectedCash
    const varianceStatus = Math.abs(variance) < 10 ? 'match' : variance > 0 ? 'over' : 'short'
    const remainingToHandover = netCashSales - totalExpenses

    return {
      grossSale,
      discount,
      netSale,
      cash,
      card,
      online,
      netCashSales,
      openReceivables,
      totalReceivable,
      expenseByCat,
      totalExpenses,
      expectedCash,
      actualCash,
      variance,
      varianceStatus,
      remainingToHandover,
    }
  }, [orders, orderTotal, transactions, receivables, shiftReconciliations, dayStr])

  const varTone =
    data.varianceStatus === 'match'
      ? 'text-emerald-300'
      : data.varianceStatus === 'over'
        ? 'text-amber-300'
        : 'text-rose-300'

  return (
    <div>
      <PageHeader title={t('dailyClosing.title')} subtitle={dateLong(`${dayStr}T00:00:00`)}>
        <div className="flex flex-wrap items-center gap-2 no-print">
          <input
            type="date"
            className="input w-44 py-2"
            value={dayStr}
            max={toDayStr(new Date())}
            onChange={(e) => setDayStr(e.target.value)}
          />
          <button onClick={safePrint} className="btn-gold px-4 py-2 text-sm">
            <IconPrint size={16} /> {t('dailyClosing.print')}
          </button>
        </div>
      </PageHeader>

      <div id="printable-report" className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <p className="font-serif text-2xl font-bold text-gold">Café Ali</p>
          <p className="text-sm text-cream-dim">{dateLong(`${dayStr}T00:00:00`)}</p>
        </div>

        {/* Revenue */}
        <Section
          title={`💰 ${t('dailyClosing.revenue')}`}
          tone="border-gold/30 bg-gold/[0.06] text-gold hover:bg-gold/[0.1]"
          open={openSec.revenue}
          onToggle={() => toggle('revenue')}
        >
          <div className="card p-5">
            <Line label={t('dailyClosing.grossSale')} value={money(data.grossSale)} tone="text-gold" />
            <Line label={t('dailyClosing.discount')} value={money(data.discount)} tone="text-rose-300" border />
            <Line label={t('dailyClosing.netSale')} value={money(data.netSale)} tone="text-gold" strong border />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-2">
                <p className="text-[11px] text-emerald-300/80">💵 {t('dailyClosing.cash')}</p>
                <p className="font-semibold text-emerald-300">{money(data.cash)}</p>
              </div>
              <div className="rounded-lg border border-sky-500/25 bg-sky-500/[0.06] p-2">
                <p className="text-[11px] text-sky-300/80">💳 {t('dailyClosing.card')}</p>
                <p className="font-semibold text-sky-300">{money(data.card)}</p>
              </div>
              <div className="rounded-lg border border-indigo-500/25 bg-indigo-500/[0.06] p-2">
                <p className="text-[11px] text-indigo-300/80">🌐 {t('dailyClosing.online')}</p>
                <p className="font-semibold text-indigo-300">{money(data.online)}</p>
              </div>
            </div>
            <Line label={t('dailyClosing.netCashSales')} value={money(data.netCashSales)} tone="text-gold" strong border />
          </div>
        </Section>

        {/* Receivables */}
        {data.openReceivables.length > 0 && (
          <Section
            title={`📋 ${t('dailyClosing.receivables')}`}
            tone="border-sky-500/30 bg-sky-500/[0.06] text-sky-300 hover:bg-sky-500/[0.1]"
            open={openSec.receivables}
            onToggle={() => toggle('receivables')}
          >
            <div className="card p-5">
              {data.openReceivables.map((r) => (
                <Line key={r.id} label={r.name} value={money(r.balance)} tone="text-sky-300" />
              ))}
              <Line label={t('dailyClosing.totalReceivable')} value={money(data.totalReceivable)} tone="text-sky-300" strong border />
            </div>
          </Section>
        )}

        {/* Expenses */}
        <Section
          title={`🔴 ${t('dailyClosing.expenses')}`}
          tone="border-rose-500/30 bg-rose-500/[0.06] text-rose-300 hover:bg-rose-500/[0.1]"
          open={openSec.expenses}
          onToggle={() => toggle('expenses')}
        >
          <div className="card p-5">
            {data.expenseByCat.length === 0 ? (
              <p className="text-sm text-cream-dim">{t('dailyClosing.noExpenses')}</p>
            ) : (
              <>
                {data.expenseByCat.map(([cat, amt]) => (
                  <Line key={cat} label={cat} value={money(amt)} tone="text-rose-300" />
                ))}
                <Line label={t('dailyClosing.totalExpenses')} value={money(data.totalExpenses)} tone="text-rose-300" strong border />
              </>
            )}
          </div>
        </Section>

        {/* Settlement */}
        <Section
          title={`✅ ${t('dailyClosing.settlement')}`}
          tone="border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300 hover:bg-emerald-500/[0.1]"
          open={openSec.settlement}
          onToggle={() => toggle('settlement')}
        >
          <div className="card p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-ink-line bg-ink-soft p-3">
                <p className="text-[11px] text-cream-dim">{t('dailyClosing.expectedCash')}</p>
                <p className="font-serif text-xl font-semibold text-cream">{money(data.expectedCash)}</p>
              </div>
              <div className="rounded-xl border border-ink-line bg-ink-soft p-3">
                <p className="text-[11px] text-cream-dim">{t('dailyClosing.actualCash')}</p>
                <p className="font-serif text-xl font-semibold text-cream">{money(data.actualCash)}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-ink-line bg-ink-soft px-4 py-3">
              <span className="text-sm text-cream-dim">{t('dailyClosing.variance')}</span>
              <span className={`font-serif text-2xl font-semibold ${varTone}`}>
                {money(Math.abs(data.variance))} · {t(`dailyClosing.${data.varianceStatus}`)}
              </span>
            </div>
            <div className="mt-3 rounded-xl border border-gold/25 bg-gold/[0.06] p-4">
              <p className="text-[11px] uppercase tracking-widest text-gold/80">{t('dailyClosing.remainingToHandover')}</p>
              <p className="mt-1 font-serif text-3xl font-semibold text-gold">{money(data.remainingToHandover)}</p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
