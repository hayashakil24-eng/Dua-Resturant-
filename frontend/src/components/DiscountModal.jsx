import { useState } from 'react'
import { money } from '../utils/format.js'
import { tableLabel } from '../data/mockData.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { IconClose, IconWallet } from './Icons.jsx'

const REASONS = [
  'VIP Customer',
  'Bulk Order',
  'Regular Customer',
  'Promotional',
  'Damaged Item',
  'Wrong Billing',
  'Other',
]

// Admin/Manager tool to knock a flat Rs. amount off a bill. `gross` is the
// bill total (subtotal + tax) before any discount; the discount is clamped to
// it so the final bill can never go negative.
export default function DiscountModal({ order, gross, onApply, onClose }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  useEscapeKey(onClose)

  const amt = Number(amount) || 0
  const newTotal = Math.max(0, gross - amt)

  const submit = () => {
    if (amt <= 0) return setError('Enter a discount amount.')
    if (amt > gross) return setError(`Discount cannot exceed ${money(gross)}.`)
    setError('')
    onApply({ amount: amt, reason: reason || 'Manual Discount', notes: notes.trim() })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">Apply Discount</h3>
              <p className="mt-0.5 text-xs text-cream-dim">
                Order {order.id} · {tableLabel(order.table)}
              </p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          {/* Current bill */}
          <div className="mt-5 rounded-2xl border border-ink-line bg-ink-soft p-4 text-center">
            <p className="text-[11px] uppercase tracking-widest text-cream-dim">Current bill total</p>
            <p className="mt-1 font-serif text-3xl font-semibold text-cream">{money(gross)}</p>
          </div>

          {/* Amount */}
          <div className="mt-5">
            <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
              Discount amount (Rs.)
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={gross}
              autoFocus
              className="input"
              placeholder="e.g. 150"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-cream-dim">Max {money(gross)}</p>
          </div>

          {/* Reason */}
          <div className="mt-4">
            <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
              Reason
            </label>
            <select
              className="input py-2.5"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">Select a reason…</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="mt-4">
            <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
              Notes (optional)
            </label>
            <textarea
              className="input h-20 resize-none"
              placeholder="e.g. Customer complained about cold food"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Preview */}
          {amt > 0 && amt <= gross && (
            <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-cream-dim">New bill total</span>
                <span className="font-serif text-2xl font-semibold text-emerald-300">
                  {money(newTotal)}
                </span>
              </div>
              <p className="mt-1 text-right text-[11px] text-cream-dim">Saves {money(amt)}</p>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              Cancel
            </button>
            <button onClick={submit} className="btn-gold flex-1 py-3">
              <IconWallet size={18} /> Apply Discount
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
