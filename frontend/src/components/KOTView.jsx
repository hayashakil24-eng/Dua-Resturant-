import { useMemo } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { StatCard } from './ui.jsx'
import { money, time, dateLong } from '../utils/format.js'
import { tableLabel } from '../data/mockData.js'
import { safePrint } from '../utils/print.js'
import { IconPrint, IconOrders, IconCash } from './Icons.jsx'

// KOT (table-wise order list) body — rendered as a tab inside Reports.
const toDayStr = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function KOTView({ dayStr }) {
  const { orders, orderTotal } = useApp()
  const t = useT()

  const rows = useMemo(
    () =>
      orders
        .filter((o) => !o.cancelled && toDayStr(o.createdAt) === dayStr)
        .map((o) => ({
          ...o,
          amount: orderTotal(o.items, o.discount?.amount, o.gstRate).total,
          qty: o.items.reduce((s, i) => s + i.qty, 0),
        }))
        .sort((a, b) => a.table - b.table),
    [orders, orderTotal, dayStr],
  )

  const summary = useMemo(() => {
    const paid = rows.filter((o) => o.payment === 'Paid')
    const by = (m) => paid.filter((o) => o.method === m).reduce((s, o) => s + o.amount, 0)
    return {
      totalOrders: rows.length,
      totalAmount: rows.reduce((s, o) => s + o.amount, 0),
      cash: by('Cash'),
      card: by('Card'),
      online: by('Online'),
    }
  }, [rows])

  const payTone = (m) =>
    m === 'Cash'
      ? 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/30'
      : m === 'Card'
        ? 'bg-sky-500/12 text-sky-300 ring-sky-500/30'
        : m === 'Online'
          ? 'bg-indigo-500/12 text-indigo-300 ring-indigo-500/30'
          : 'bg-white/5 text-cream-dim ring-ink-line'

  return (
    <div>
      <div className="mb-4 flex justify-end no-print">
        <button onClick={() => safePrint('print-report')} className="btn-gold px-4 py-2 text-sm">
          <IconPrint size={16} /> {t('dailyClosing.print')}
        </button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IconOrders} label={t('kot.totalOrders')} value={summary.totalOrders} sub={dateLong(`${dayStr}T00:00:00`)} />
        <StatCard icon={IconCash} label={t('kot.totalAmount')} value={money(summary.totalAmount)} sub={t('kot.grandTotal')} />
        <StatCard icon={IconCash} label={`💵 ${t('kot.cash')}`} value={money(summary.cash)} />
        <StatCard icon={IconCash} label={`💳 ${t('kot.card')} / 🌐 ${t('kot.online')}`} value={money(summary.card + summary.online)} />
      </div>

      <div id="printable-report" className="card overflow-hidden">
        <div className="border-b border-ink-line p-4 text-center">
          <p className="font-serif text-xl font-bold text-gold">Café Ali — {t('kot.title')}</p>
          <p className="text-xs text-cream-dim">{dateLong(`${dayStr}T00:00:00`)}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-line text-xs uppercase tracking-wider text-cream-dim">
                <th className="px-5 py-3 font-semibold">{t('kot.colTableType')}</th>
                <th className="px-5 py-3 font-semibold">{t('kot.colItems')}</th>
                <th className="px-5 py-3 text-center font-semibold">{t('kot.colQty')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('kot.colAmount')}</th>
                <th className="px-5 py-3 text-center font-semibold">{t('kot.colPayment')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('kot.colTime')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-line">
              {rows.map((o) => (
                <tr key={o.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-semibold text-cream">{tableLabel(o.table)}</td>
                  <td className="px-5 py-3 text-cream-dim">{o.items.map((i) => `${i.name} ×${i.qty}`).join(', ')}</td>
                  <td className="px-5 py-3 text-center text-cream-dim">{o.qty}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gold">{money(o.amount)}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`badge ring-1 ${payTone(o.method)}`}>
                      {o.payment === 'Paid' ? o.method : o.payment}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-cream-dim">{time(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-ink-line font-bold">
                  <td className="px-5 py-3 text-cream" colSpan={3}>{t('kot.grandTotal')}</td>
                  <td className="px-5 py-3 text-right text-gold">{money(summary.totalAmount)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {rows.length === 0 && <div className="p-10 text-center text-sm text-cream-dim">{t('kot.noOrders')}</div>}
      </div>
    </div>
  )
}
