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

const QUICK_PERCENTS = [5, 10, 15, 20, 25, 50]

// Admin/Manager tool to knock money off a bill, either as a percentage of the
// bill or as a flat Rs. figure. `bill` is the order's own breakdown BEFORE any
// discount ({ subtotal, tax, total }) — GST is added first and the discount
// comes off that total, so the percentage is a percentage of what the customer
// would otherwise pay. The breakdown is shown here because "10% of what?" is
// the first thing anyone asks. In percent mode the rupee figure is only a
// preview: the server recomputes it from the percent it is sent.
export default function DiscountModal({ order, bill, rate = 0, onApply, onClose }) {
  const gross = bill.total
  const [mode, setMode] = useState('percent') // 'percent' | 'amount'
  const [percent, setPercent] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  useEscapeKey(onClose)

  const byPercent = mode === 'percent'
  const pct = Number(percent) || 0
  const amt = byPercent ? Math.round((gross * pct) / 100) : Number(amount) || 0
  const newTotal = Math.max(0, gross - amt)

  const submit = () => {
    if (byPercent) {
      if (!Number.isInteger(pct) || pct <= 0 || pct > 100) return setError('Enter a whole percentage between 1 and 100.')
    } else {
      if (amt <= 0) return setError('Enter a discount amount.')
      if (amt > gross) return setError(`Discount cannot exceed ${money(gross)}.`)
    }
    setError('')
    onApply({
      ...(byPercent ? { percent: pct } : { amount: amt }),
      reason: reason || 'Manual Discount',
      notes: notes.trim(),
    })
  }

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setPercent('')
    setAmount('')
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

          {/* Current bill — GST shown separately so it's obvious the discount
              is taken off the GST-inclusive total, not the subtotal. */}
          <div className="mt-5 rounded-2xl border border-ink-line bg-ink-soft p-4">
            {bill.tax > 0 && (
              <div className="mb-2 space-y-1 border-b border-ink-line pb-2 text-xs">
                <div className="flex justify-between text-cream-dim">
                  <span>Subtotal</span>
                  <span className="text-cream">{money(bill.subtotal)}</span>
                </div>
                <div className="flex justify-between text-cream-dim">
                  <span>+ GST ({Math.round(rate * 100)}%)</span>
                  <span className="text-cream">{money(bill.tax)}</span>
                </div>
              </div>
            )}
            <p className="text-center text-[11px] uppercase tracking-widest text-cream-dim">
              Bill total{bill.tax > 0 ? ' (with GST)' : ''}
            </p>
            <p className="mt-1 text-center font-serif text-3xl font-semibold text-cream">{money(gross)}</p>
          </div>

          {/* Percentage or flat rupees */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            {[
              { key: 'percent', label: 'Percentage (%)' },
              { key: 'amount', label: 'Fixed (Rs.)' },
            ].map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => switchMode(m.key)}
                className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                  mode === m.key
                    ? 'border-gold/50 bg-gold/12 text-gold'
                    : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {byPercent ? (
            <div className="mt-4">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                Discount percentage (%)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                step={1}
                autoFocus
                className="input"
                placeholder="e.g. 10"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_PERCENTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPercent(String(p))
                      setError('')
                    }}
                    className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                      pct === p
                        ? 'border-gold/50 bg-gold/12 text-gold'
                        : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
              {pct > 0 && pct <= 100 && (
                <p className="mt-2 text-[11px] text-cream-dim">
                  {pct}% of {money(gross)}
                  {bill.tax > 0 ? ' (with GST)' : ''} = <span className="text-gold">{money(amt)}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4">
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
          )}

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
              <p className="mt-1 text-right text-[11px] text-cream-dim">
                Saves {money(amt)}
                {byPercent ? ` (${pct}%)` : ''}
              </p>
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
