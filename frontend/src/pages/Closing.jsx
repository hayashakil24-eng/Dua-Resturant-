import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader } from '../components/ui.jsx'
import { money, dateLong, time } from '../utils/format.js'
import { canModify } from '../config/permissions.js'
import { safePrint } from '../utils/print.js'
import { buildClosingReport, toDayStr } from '../utils/closing.js'
import ClosingSummaryTable from '../components/ClosingSummaryTable.jsx'
import ClosingSlip from '../components/ClosingSlip.jsx'
import { IconPrint, IconCheck, IconAlert, IconClose } from '../components/Icons.jsx'

export default function Closing() {
  const { orders, orderTotal, transactions, user, dailyClosings, saveDailyClosing, inventory, recipes } = useApp()
  const canClose = user && canModify(user.role, 'closing')
  const todayStr = useMemo(() => toDayStr(new Date()), [])

  // Today's figures — same numbers the daily report / receipts show, re-shaped
  // into the client's cash-handover closing sheet.
  const report = useMemo(
    () => buildClosingReport(orders, orderTotal, transactions, todayStr, inventory, recipes),
    [orders, orderTotal, transactions, todayStr, inventory, recipes],
  )
  const liveMeta = { closedBy: user?.name, closedByRole: user?.role, closingTime: new Date().toISOString() }

  // Bills that must be resolved (Udhaar or Complimentary) before the day can
  // be closed — closing previously just silently excluded these from the
  // totals instead of blocking, so an unresolved bill's cash was never
  // actually accounted for anywhere. Mirrors buildClosingReport's own
  // same-day scoping (toDayStr(o.createdAt) === todayStr).
  const pendingOrders = useMemo(
    () => orders.filter((o) => o.payment === 'Unpaid' && !o.cancelled && toDayStr(o.createdAt) === todayStr),
    [orders, todayStr],
  )

  const [slip, setSlip] = useState(null) // { report, meta } currently armed for printing
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const armAndPrint = (rep, meta) => {
    setSlip({ report: rep, meta })
    setTimeout(() => safePrint('print-closing'), 60)
  }
  const printCurrent = () => armAndPrint(report, liveMeta)
  const printRecord = (rec) =>
    armAndPrint(rec, { closedBy: rec.closedBy, closedByRole: rec.closedByRole, closingTime: rec.closingTime })

  const onSave = async () => {
    const res = await saveDailyClosing(report)
    if (res?.error) {
      setSaved(false)
      return setError(res.error)
    }
    setError('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <PageHeader
        title="Day Closing"
        subtitle="End-of-day closing report — print & save. The POS stays open; the next day's orders start a fresh date automatically."
      >
        {canClose && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={printCurrent} className="btn-ghost px-4 py-2 text-sm">
              <IconPrint size={16} /> Print
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={pendingOrders.length > 0}
              title={pendingOrders.length > 0 ? 'Resolve the pending bills below first' : undefined}
              className="btn-gold px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconCheck size={16} /> Save Closing
            </button>
          </div>
        )}
      </PageHeader>

      {pendingOrders.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <p className="font-semibold">
            <IconAlert size={14} className="me-1 inline" />
            {pendingOrders.length} bill{pendingOrders.length > 1 ? 's are' : ' is'} still unpaid — closing is blocked
            until each is marked Udhaar (on-account) or Complimentary.
          </p>
          <ul className="mt-1.5 list-inside list-disc text-xs text-amber-300/80">
            {pendingOrders.map((o) => (
              <li key={o.id}>
                {o.id} · Table {o.table} · {money(orderTotal(o.items, o.discount?.amount, o.gstRate).total)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}
      {saved && (
        <p className="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Closing report saved to history.
        </p>
      )}

      {/* On-screen preview — exactly the sheet that prints (white document). */}
      <div className="mx-auto max-w-2xl rounded-xl bg-white p-4 shadow-lift sm:p-6">
        <ClosingSummaryTable report={report} meta={liveMeta} />
      </div>

      {/* Closing history */}
      <div className="card mx-auto mt-6 max-w-2xl p-6">
        <h3 className="mb-4 font-serif text-lg text-cream">Closing History</h3>
        {dailyClosings.length === 0 ? (
          <p className="text-sm text-cream-dim">No closings saved yet.</p>
        ) : (
          <ul className="divide-y divide-ink-line">
            {dailyClosings.map((rec) => (
              <li key={rec.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-cream">{dateLong(`${rec.date}T00:00:00`)}</p>
                  <p className="mt-0.5 text-xs text-cream-dim">
                    Closed by {rec.closedBy} ({rec.closedByRole}) · {time(rec.closingTime)} · handover{' '}
                    {money(rec.remainingHandover)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-serif text-lg font-semibold text-gold">{money(rec.netSale)}</span>
                  <button
                    onClick={() => printRecord(rec)}
                    className="rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 text-xs font-semibold text-cream-dim transition hover:text-cream"
                  >
                    <IconPrint size={14} /> Print
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Hidden print surface — armed by the Print buttons above. */}
      <ClosingSlip report={slip?.report} meta={slip?.meta} />

      {confirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmOpen(false)} />
          <div className="relative z-10 w-full max-w-md animate-fade-up">
            <div className="card p-6">
              <div className="flex items-start justify-between">
                <h3 className="font-serif text-2xl text-cream">Save today's closing?</h3>
                <button onClick={() => setConfirmOpen(false)} className="text-cream-dim hover:text-cream">
                  <IconClose size={20} />
                </button>
              </div>
              <p className="mt-3 text-sm text-cream-dim">
                This saves today's report ({money(report.netSale)} net sale) to Closing History. The POS keeps
                running — tomorrow's orders start a fresh date automatically — but this saved record can't be
                edited from this screen afterward.
              </p>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setConfirmOpen(false)} className="btn-ghost flex-1 py-3">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setConfirmOpen(false)
                    onSave()
                  }}
                  className="btn-gold flex-1 py-3"
                >
                  <IconCheck size={18} /> Yes, Save Closing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
