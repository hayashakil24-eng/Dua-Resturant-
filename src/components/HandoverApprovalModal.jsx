import { useState } from 'react'
import { money, time } from '../utils/format.js'
import { useT } from '../i18n/LanguageContext.jsx'
import { IconClose } from './Icons.jsx'

// Manager/Admin reviews a pending cash handover from a cashier and accepts or
// rejects it (rejection needs a reason). Shown on the Dashboard, which is Urdu
// for Manager/Admin, so this is translated.
export default function HandoverApprovalModal({ handover, onAccept, onReject, onClose }) {
  const t = useT()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <h3 className="font-serif text-2xl text-cream">{t('handover.approvalTitle')}</h3>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 space-y-2 rounded-2xl border border-ink-line bg-ink-soft p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-cream-dim">{t('handover.from')}</span>
              <span className="font-semibold text-cream">{handover.fromName}</span>
            </div>
            <div className="flex items-center justify-between border-t border-ink-line pt-2">
              <span className="text-cream-dim">{t('handover.amount')}</span>
              <span className="font-serif text-2xl font-semibold text-gold">{money(handover.amount)}</span>
            </div>
            {handover.reason && (
              <div className="flex justify-between">
                <span className="text-cream-dim">{t('handover.reason')}</span>
                <span className="text-cream">{handover.reason}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-cream-dim">{t('handover.time')}</span>
              <span className="text-cream">{time(handover.initiatedAt)}</span>
            </div>
          </div>

          {rejecting ? (
            <div className="mt-5">
              <input
                autoFocus
                className="input"
                placeholder={t('handover.rejectReasonPh')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="mt-3 flex gap-3">
                <button onClick={() => setRejecting(false)} className="btn-ghost flex-1 py-2.5">
                  {t('handover.back')}
                </button>
                <button
                  onClick={() => onReject(handover.id, reason.trim())}
                  disabled={!reason.trim()}
                  className="flex-1 rounded-xl bg-rose-500/90 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-40"
                >
                  ✕ {t('handover.confirmReject')}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex gap-3">
              <button onClick={() => setRejecting(true)} className="btn-ghost flex-1 py-3">
                ✕ {t('handover.reject')}
              </button>
              <button onClick={() => onAccept(handover.id)} className="btn-gold flex-1 py-3">
                ✓ {t('handover.accept')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
