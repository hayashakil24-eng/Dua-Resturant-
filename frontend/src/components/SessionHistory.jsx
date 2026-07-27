import { useState } from 'react'
import { useT } from '../i18n/LanguageContext.jsx'
import { money, time } from '../utils/format.js'
import { safePrint } from '../utils/print.js'
import { sessionLabel, sessionDuration } from '../utils/sessions.js'
import ClosingSlip from './ClosingSlip.jsx'
import { IconPrint } from './Icons.jsx'

// Every past recording window, newest first — the report history that was
// previously only reachable from the Day Closing page. Two ways to open a
// session: [View] re-derives the full report (overview / summary / item-wise /
// KOT) for that window from live orders, while [Print sheet] reprints the
// frozen snapshot saved at closing time, untouched.
//
// The list's own figures come from the frozen record, not a recompute, so this
// table always shows what was actually signed off at closing.
export default function SessionHistory({ sessions, onView }) {
  const t = useT()
  const [slip, setSlip] = useState(null) // { report, meta } currently armed for printing
  const past = sessions.filter((s) => !s.open && s.record)

  // Same arm-then-print handshake as Closing.jsx's printRecord — the portal
  // has to render before window.print() fires.
  const printRecord = (rec) => {
    setSlip({
      report: rec,
      meta: { closedBy: rec.closedBy, closedByRole: rec.closedByRole, closingTime: rec.closingTime },
    })
    setTimeout(() => safePrint('print-closing'), 60)
  }

  if (past.length === 0) {
    return (
      <div className="card mx-auto max-w-2xl p-10 text-center text-sm text-cream-dim">
        {t('reports.noSessions')}
      </div>
    )
  }

  return (
    <div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-line text-xs uppercase tracking-wider text-cream-dim">
                <th className="px-5 py-3 font-semibold">{t('reports.period')}</th>
                <th className="px-5 py-3 font-semibold">{t('reports.duration')}</th>
                <th className="px-5 py-3 text-center font-semibold">{t('reports.totalOrders')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('reports.netSale')}</th>
                <th className="px-5 py-3 font-semibold">{t('reports.closedBy')}</th>
                <th className="px-5 py-3 text-right font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-line">
              {past.map((s) => (
                <tr key={s.id} className="transition hover:bg-white/[0.02]">
                  {/* dir=ltr — the arrow is direction-neutral, so in Urdu the
                      two ends of the window would otherwise swap visually. */}
                  <td className="px-5 py-3 font-semibold text-cream" dir="ltr">
                    {sessionLabel(s, t)}
                  </td>
                  <td className="px-5 py-3 text-cream-dim">{sessionDuration(s) || '—'}</td>
                  <td className="px-5 py-3 text-center text-cream-dim">{s.record.totalOrders ?? '—'}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gold">
                    {money(s.record.netSale ?? s.record.totalSales)}
                  </td>
                  <td className="px-5 py-3 text-cream-dim">
                    {s.record.closedBy}
                    <span className="block text-xs">{time(s.record.closingTime)}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onView(s.id)}
                        className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20"
                      >
                        {t('reports.viewSession')}
                      </button>
                      <button
                        onClick={() => printRecord(s.record)}
                        className="rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 text-xs font-semibold text-cream-dim transition hover:text-cream"
                      >
                        <IconPrint size={14} /> {t('reports.printSheet')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden print surface — armed by the Print sheet buttons above. */}
      <ClosingSlip report={slip?.report} meta={slip?.meta} />
    </div>
  )
}
