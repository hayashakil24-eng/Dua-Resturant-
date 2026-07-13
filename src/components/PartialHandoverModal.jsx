import { useMemo, useState } from 'react'
import { money } from '../utils/format.js'
import { useApp } from '../context/AppContext.jsx'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { IconClose, IconCash } from './Icons.jsx'

// Cashier mid-shift partial handover. English + LTR (cashier flow). Submitting
// creates a PENDING handover — the cash only leaves the drawer once a
// Manager/Admin accepts it from their dashboard. `current` is the live drawer
// balance; `onSubmit({ amount, toName, toRole, reason })`.
export default function PartialHandoverModal({ current, onClose, onSubmit }) {
  const { staff } = useApp()
  const [amount, setAmount] = useState('')
  const [toId, setToId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  useEscapeKey(onClose)

  // Recipients: active Managers (cash is handed up the chain). Fallback to all
  // active staff if none are Managers so the picker is never empty.
  const recipients = useMemo(() => {
    const active = staff.filter((s) => s.active !== false)
    const managers = active.filter((s) => s.role === 'Manager')
    return managers.length ? managers : active
  }, [staff])

  const amt = Number(amount) || 0
  const remaining = current - amt

  const submit = () => {
    if (amt <= 0 || amt > current) return setError('Enter a valid amount within the drawer balance.')
    if (!toId) return setError('Select who receives the cash.')
    const person = recipients.find((s) => s.id === toId)
    setError('')
    onSubmit({ amount: amt, toName: person?.name || 'Manager', toRole: person?.role || 'Manager', reason: reason.trim() })
  }

  return (
    <div dir="ltr" className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-md flex-col animate-fade-up">
        <div className="card flex min-h-0 flex-col p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">Partial Handover</h3>
              <p className="text-xs text-cream-dim">Hand part of the drawer to a manager (needs approval).</p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
            {/* Current drawer */}
            <div className="rounded-2xl border border-gold/25 bg-gold/[0.06] p-4 text-center">
              <p className="text-[11px] uppercase tracking-widest text-gold/80">Current drawer</p>
              <p className="mt-1 font-serif text-3xl font-semibold text-gold">{money(current)}</p>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                Handover amount (Rs.)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={current}
                autoFocus
                className="input"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {amt > 0 && amt <= current && (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-2.5">
                <span className="text-sm text-cream-dim">Remaining in drawer</span>
                <span className="font-serif text-lg font-semibold text-emerald-300">{money(remaining)}</span>
              </div>
            )}

            <div className="mt-4">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                Hand over to
              </label>
              <select className="input py-2.5" value={toId} onChange={(e) => setToId(e.target.value)}>
                <option value="">Select recipient…</option>
                {recipients.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                Reason (optional)
              </label>
              <textarea
                className="input h-16 resize-none"
                placeholder="e.g. too much cash in the drawer"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {error && (
              <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
            )}
          </div>

          <div className="mt-6 flex flex-shrink-0 gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              Cancel
            </button>
            <button onClick={submit} className="btn-gold flex-1 py-3">
              <IconCash size={18} /> Submit Handover
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
