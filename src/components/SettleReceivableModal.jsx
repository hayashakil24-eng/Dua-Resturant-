import { useState } from 'react'
import { money } from '../utils/format.js'
import { useT } from '../i18n/LanguageContext.jsx'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { IconClose, IconCheck } from './Icons.jsx'

const METHODS = ['Cash', 'Card', 'Bank Transfer', 'Cheque', 'Online']

// Admin/Manager records a payment against a credit account. Amount defaults to
// the full outstanding balance (settle); a smaller amount is a partial payment.
export default function SettleReceivableModal({ receivable, onClose, onConfirm }) {
  const t = useT()
  const [amount, setAmount] = useState(String(receivable.balance))
  const [method, setMethod] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  useEscapeKey(onClose)

  const amt = Number(amount) || 0
  const willSettle = amt >= receivable.balance

  const submit = () => {
    if (amt <= 0 || amt > receivable.balance) return setError(t('receivables.errAmount'))
    onConfirm({ amount: amt, method, notes: notes.trim() })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-md flex-col animate-fade-up">
        <div className="card flex min-h-0 flex-col p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">{t('receivables.settleTitle')}</h3>
              <p className="text-xs text-cream-dim">{receivable.name}</p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
            <div className="rounded-2xl border border-gold/25 bg-gold/[0.06] p-4 text-center">
              <p className="text-[11px] uppercase tracking-widest text-gold/80">{t('receivables.outstanding')}</p>
              <p className="mt-1 font-serif text-3xl font-semibold text-gold">{money(receivable.balance)}</p>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('receivables.amountReceived')}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={receivable.balance}
                autoFocus
                className="input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('receivables.paymentMethod')}
              </label>
              <select className="input py-2.5" value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('receivables.notesOptional')}
              </label>
              <textarea
                className="input h-16 resize-none"
                placeholder={t('receivables.notesPh')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <p
              className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
                willSettle
                  ? 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300'
                  : 'border-sky-500/25 bg-sky-500/[0.06] text-sky-300'
              }`}
            >
              {willSettle ? `✓ ${t('receivables.willSettle')}` : t('receivables.willReduce')}
            </p>

            {error && (
              <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
            )}
          </div>

          <div className="mt-6 flex flex-shrink-0 gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              {t('common.cancel')}
            </button>
            <button onClick={submit} className="btn-gold flex-1 py-3">
              <IconCheck size={18} /> {t('receivables.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
