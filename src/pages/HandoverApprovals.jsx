import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useLang } from '../i18n/LanguageContext.jsx'
import { money, time, dateShort } from '../utils/format.js'
import HandoverApprovalModal from '../components/HandoverApprovalModal.jsx'
import { IconCash } from '../components/Icons.jsx'

// Dedicated Manager/Admin page to review cash handovers. Pending tab reuses the
// same accept/reject flow as the Dashboard panel; Processed tab is the
// immutable history (accepted + rejected) — resolved records stay in
// pendingHandovers with a status + resolver, so no separate log is needed.
export default function HandoverApprovals() {
  const { pendingHandovers, acceptHandover, rejectHandover } = useApp()
  const { t } = useLang()
  const [tab, setTab] = useState('pending')
  const [selected, setSelected] = useState(null)

  const pending = useMemo(() => pendingHandovers.filter((h) => h.status === 'pending'), [pendingHandovers])
  const processed = useMemo(
    () =>
      pendingHandovers
        .filter((h) => h.status !== 'pending')
        .sort((a, b) => new Date(b.resolvedAt || 0) - new Date(a.resolvedAt || 0)),
    [pendingHandovers],
  )

  const tabBtn = (key, label, count) => (
    <button
      onClick={() => setTab(key)}
      className={`border-b-2 px-4 py-2 text-sm font-semibold transition ${
        tab === key ? 'border-gold text-gold' : 'border-transparent text-cream-dim hover:text-cream'
      }`}
    >
      {label}
      {count != null && <span className="ms-1.5 text-xs">({count})</span>}
    </button>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-serif text-3xl font-bold text-cream">
          <IconCash size={26} /> {t('handover.pageTitle')}
        </h1>
        <p className="mt-1 text-sm text-cream-dim">{t('handover.subtitle')}</p>
      </div>

      <div className="mb-5 flex gap-2 border-b border-ink-line">
        {tabBtn('pending', t('handover.tabPending'), pending.length)}
        {tabBtn('processed', t('handover.tabProcessed'), processed.length)}
      </div>

      {/* Pending */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {pending.length === 0 && (
            <div className="card p-12 text-center text-sm text-cream-dim">{t('handover.noPending')}</div>
          )}
          {pending.map((h) => (
            <div key={h.id} className="card flex flex-wrap items-center justify-between gap-4 border border-amber-500/30 bg-amber-500/[0.05] p-5">
              <div className="min-w-0">
                <p className="text-cream">
                  <span className="font-semibold">{h.fromName}</span>{' '}
                  <span className="text-cream-dim">{t('handover.wantsToHandOver')}</span>{' '}
                  <span className="font-serif text-lg font-semibold text-gold">{money(h.amount)}</span>{' '}
                  <span className="text-cream-dim">→ {h.toName}</span>
                </p>
                <p className="mt-1 text-xs text-cream-dim">
                  {dateShort(h.initiatedAt)} · {time(h.initiatedAt)}
                  {h.reason ? ` · ${h.reason}` : ''}
                </p>
              </div>
              <button onClick={() => setSelected(h)} className="btn-gold shrink-0">
                {t('handover.review')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Processed history */}
      {tab === 'processed' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-line text-xs uppercase tracking-wider text-cream-dim">
                  <th className="px-5 py-3 font-semibold">{t('handover.from')}</th>
                  <th className="px-5 py-3 font-semibold">{t('handover.to')}</th>
                  <th className="px-5 py-3 text-right font-semibold">{t('handover.amount')}</th>
                  <th className="px-5 py-3 text-center font-semibold">{t('handover.status')}</th>
                  <th className="px-5 py-3 font-semibold">{t('handover.reason')}</th>
                  <th className="px-5 py-3 font-semibold">{t('handover.resolvedBy')}</th>
                  <th className="px-5 py-3 text-right font-semibold">{t('handover.time')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line">
                {processed.map((h) => (
                  <tr key={h.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-semibold text-cream">{h.fromName}</td>
                    <td className="px-5 py-3 text-cream-dim">{h.toName}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gold">{money(h.amount)}</td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`badge ring-1 ${
                          h.status === 'accepted'
                            ? 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/30'
                            : 'bg-rose-500/12 text-rose-300 ring-rose-500/30'
                        }`}
                      >
                        {h.status === 'accepted' ? t('handover.statusAccepted') : t('handover.statusRejected')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-cream-dim">{h.rejectReason || '—'}</td>
                    <td className="px-5 py-3 text-cream-dim">{h.resolvedBy || '—'}</td>
                    <td className="px-5 py-3 text-right text-cream-dim">
                      {h.resolvedAt ? `${dateShort(h.resolvedAt)} · ${time(h.resolvedAt)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {processed.length === 0 && (
            <div className="p-12 text-center text-sm text-cream-dim">{t('handover.noProcessed')}</div>
          )}
        </div>
      )}

      {selected && (
        <HandoverApprovalModal
          handover={selected}
          onAccept={(id) => {
            acceptHandover(id)
            setSelected(null)
          }}
          onReject={(id, reason) => {
            rejectHandover(id, reason)
            setSelected(null)
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
