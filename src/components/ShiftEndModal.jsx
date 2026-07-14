import { useMemo, useState } from 'react'
import { money } from '../utils/format.js'
import { useApp } from '../context/AppContext.jsx'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { IconClose, IconCash } from './Icons.jsx'

// Module-scope so its identity is stable across the modal's re-renders (a
// nested definition would remount on every keystroke).
function Row({ label, value, strong }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-cream-dim">{label}</span>
      <span className={strong ? 'font-semibold text-cream' : 'text-cream'}>{value}</span>
    </div>
  )
}

// End-of-shift cash count. Shows the system's expected drawer total (opening +
// cash sales) and asks the cashier for the physical count; the live preview
// flags any shortage/excess before they commit. `onComplete(shiftId, actual)`.
export default function ShiftEndModal({ shift, onClose, onComplete }) {
  const { calculateShiftSales, staff } = useApp()
  const [actual, setActual] = useState('')
  const [handoverTo, setHandoverTo] = useState('Admin') // 'Admin' | 'Manager' | 'Other'
  const [handoverPerson, setHandoverPerson] = useState('') // staff id when 'Other'
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  useEscapeKey(onClose)

  const sales = useMemo(() => calculateShiftSales(shift.id), [calculateShiftSales, shift.id])
  const others = useMemo(() => staff.filter((s) => s.active !== false), [staff])

  if (!sales) return null

  const counted = Number(actual)
  const hasCount = actual !== '' && !Number.isNaN(counted)
  const difference = sales.expectedCash - counted // + shortage, − excess
  const matched = Math.abs(difference) < 10

  const submit = () => {
    if (!hasCount || counted < 0) return setError('Enter the actual cash counted.')
    if (handoverTo === 'Other' && !handoverPerson)
      return setError('Select the person receiving the cash.')
    setError('')
    const name =
      handoverTo === 'Other'
        ? others.find((s) => s.id === handoverPerson)?.name || 'Other'
        : handoverTo
    onComplete(shift.id, counted, { to: handoverTo, name, reason: reason.trim() })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col animate-fade-up">
        <div className="card flex min-h-0 flex-col p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
                <IconCash size={22} />
              </span>
              <div>
                <h3 className="font-serif text-2xl text-cream">End Shift · Cash Count</h3>
                <p className="text-xs text-cream-dim">Count the drawer at close and record who receives the closing cash. No approval needed.</p>
              </div>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
            {/* Expected drawer breakdown */}
            <div className="rounded-2xl border border-ink-line bg-ink-soft p-4">
              <div className="space-y-2">
                <Row label="Opening cash" value={money(shift.openingCash)} />
                <Row label="Cash sales" value={money(sales.totalCashSales)} />
                <Row label="Card sales" value={money(sales.totalCardSales)} />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-ink-line pt-3">
                <span className="text-sm font-semibold text-cream">Expected cash</span>
                <span className="font-serif text-2xl font-semibold text-gold">
                  {money(sales.expectedCash)}
                </span>
              </div>
            </div>

            {/* Physical count */}
            <div className="mt-5">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                Actual cash counted (Rs.)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                autoFocus
                className="input"
                placeholder="Count the drawer and enter"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
              />
            </div>

            {/* Hand cash over to */}
            <div className="mt-5">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                Closing cash handed to
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Admin', 'Manager', 'Other'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setHandoverTo(opt)}
                    className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                      handoverTo === opt
                        ? 'border-gold/50 bg-gold/12 text-gold'
                        : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                    }`}
                  >
                    {opt === 'Other' ? 'Other person' : opt}
                  </button>
                ))}
              </div>
              {handoverTo === 'Other' && (
                <select
                  className="input mt-2 py-2.5"
                  value={handoverPerson}
                  onChange={(e) => setHandoverPerson(e.target.value)}
                >
                  <option value="">Select person…</option>
                  {others.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Reason (optional) */}
            <div className="mt-4">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                Reason (optional)
              </label>
              <textarea
                className="input h-16 resize-none"
                placeholder="e.g. handed to manager after count…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {/* Live match / mismatch preview */}
            {hasCount && counted >= 0 && (
              <div
                className={`mt-4 rounded-2xl border p-4 ${
                  matched
                    ? 'border-emerald-500/30 bg-emerald-500/[0.08]'
                    : difference > 0
                      ? 'border-rose-500/30 bg-rose-500/[0.08]'
                      : 'border-sky-500/30 bg-sky-500/[0.08]'
                }`}
              >
                {matched ? (
                  <p className="text-sm font-semibold text-emerald-300">✓ Cash matches the drawer.</p>
                ) : difference > 0 ? (
                  <p className="text-sm font-semibold text-rose-300">
                    Shortage of {money(Math.abs(difference))}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-sky-300">
                    Excess of {money(Math.abs(difference))}
                  </p>
                )}
                {!matched && (
                  <p className="mt-1 text-[11px] text-cream-dim">
                    This will be flagged to the Admin/Manager dashboard.
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
            )}

            {/* Submitting closes the drawer AND signs the cashier out — one action. */}
            <div className="mt-4 rounded-lg border border-sky-500/25 bg-sky-500/[0.06] px-3 py-2 text-[11px] text-sky-200">
              Submitting completes your shift and logs you out automatically.
            </div>
          </div>

          <div className="mt-6 flex flex-shrink-0 gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              Cancel · Keep Working
            </button>
            <button onClick={submit} className="btn-gold flex-1 py-3">
              <IconCash size={18} /> Submit &amp; Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
