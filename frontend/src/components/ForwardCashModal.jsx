import { useState } from 'react'
import { createPortal } from 'react-dom'
import { money } from '../utils/format.js'
import { useT } from '../i18n/LanguageContext.jsx'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { IconClose, IconWallet } from './Icons.jsx'

// Manager → Admin. The recipient is fixed: cash flows Cashier → Manager/Admin →
// Admin, so the Admin is the only place this leg can go and there is nothing to
// pick. Submitting creates a PENDING handover — the cash only counts as the
// Admin's once an Admin accepts it, exactly like a cashier's handover.
// `held` is what the manager is still holding; `onSubmit({ amount, reason })`.
export default function ForwardCashModal({ held, onClose, onSubmit }) {
  const t = useT()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  useEscapeKey(onClose)

  const amt = Number(amount) || 0
  const remaining = held - amt

  // onSubmit is async — the backend re-checks the cap against what the manager
  // actually holds, so a stale figure surfaces as an error instead of the modal
  // closing as if it had worked.
  const submit = async () => {
    if (amt <= 0 || amt > held) return setError(t('handover.forwardInvalid'))
    setError('')
    setSubmitting(true)
    const res = await onSubmit({ amount: amt, reason: reason.trim() })
    setSubmitting(false)
    if (res?.error) setError(res.error)
  }

  // Portaled to <body> for the same reason HandoverApprovalModal is: this opens
  // from the Dashboard's Cash on Hand panel, so rendered in-tree it inherits
  // whatever the surrounding page layout does to it — the panel's own card box
  // clipped the "full screen" overlay and trapped its z-index in that stacking
  // context, and the page's space-y stack pushed the overlay's top edge down.
  // As a body-level sibling it is positioned against the viewport, full stop.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-md flex-col animate-fade-up">
        <div className="card flex min-h-0 flex-col p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">{t('handover.forwardTitle')}</h3>
              <p className="text-xs text-cream-dim">{t('handover.forwardSub')}</p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
            <div className="rounded-2xl border border-gold/25 bg-gold/[0.06] p-4 text-center">
              <p className="text-[11px] uppercase tracking-widest text-gold">{t('handover.youHold')}</p>
              <p className="mt-1 font-serif text-3xl font-semibold text-gold">{money(held)}</p>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('handover.forwardAmount')}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={held}
                autoFocus
                className="input"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setAmount(String(held))}
                className="mt-2 text-xs font-semibold text-gold hover:underline"
              >
                {t('handover.forwardAll')}
              </button>
            </div>

            {amt > 0 && amt <= held && (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-2.5">
                <span className="text-sm text-cream-dim">{t('handover.forwardRemaining')}</span>
                <span className="font-serif text-lg font-semibold text-emerald-300">{money(remaining)}</span>
              </div>
            )}

            <div className="mt-4">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('handover.reasonOptional')}
              </label>
              <textarea
                className="input h-16 resize-none"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {error && (
              <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
            )}
          </div>

          <div className="mt-6 flex flex-shrink-0 gap-3">
            <button onClick={onClose} disabled={submitting} className="btn-ghost flex-1 py-3 disabled:opacity-60">
              {t('handover.cancel')}
            </button>
            <button onClick={submit} disabled={submitting} className="btn-gold flex-1 py-3 disabled:opacity-60">
              <IconWallet size={18} />{' '}
              {submitting ? t('handover.sending') : t('handover.forwardConfirm')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
