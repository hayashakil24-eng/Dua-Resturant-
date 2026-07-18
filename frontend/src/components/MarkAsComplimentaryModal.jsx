import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { money } from '../utils/format.js'
import { tableLabel } from '../data/mockData.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { IconClose, IconCheck } from './Icons.jsx'

// Mark an unpaid order as complimentary (free / on-the-house). English + LTR to
// match the Orders/POS operational flow. onConfirm({ orderedBy, reason, notes }).
const REASONS = [
  "Owner's Guest",
  'Staff Meal',
  'Promotional',
  'Damaged Item',
  'VIP Guest',
  "Owner's Relative",
  'Business Partner',
  'Other',
]

export default function MarkAsComplimentaryModal({ order, onClose, onConfirm }) {
  const { orderTotal } = useApp()
  const total = orderTotal(order.items, order.discount?.amount, order.gstRate).total
  const [orderedBy, setOrderedBy] = useState('')
  const [reason, setReason] = useState(REASONS[0])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  useEscapeKey(onClose)

  const confirm = () => {
    if (!orderedBy.trim()) return setError('Enter who authorised the free order.')
    onConfirm({ orderedBy: orderedBy.trim(), reason, notes: notes.trim() })
  }

  return (
    <div dir="ltr" className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/25">
                🎁
              </span>
              <div>
                <h3 className="font-serif text-2xl text-cream">Mark as Complimentary</h3>
                <p className="text-xs text-cream-dim">Give this order free (on the house). No cash, no due.</p>
              </div>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          {/* Bill */}
          <div className="mt-5 rounded-2xl border border-ink-line bg-ink-soft p-4 text-center">
            <p className="text-[11px] uppercase tracking-widest text-gold">Bill amount (waived)</p>
            <p className="mt-1 font-serif text-3xl font-semibold text-gold">{money(total)}</p>
            <p className="mt-1 text-xs text-cream-dim">
              {order.id} · {tableLabel(order.table)}
            </p>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
              Authorised / ordered by <span className="text-rose-300">*</span>
            </label>
            <input
              autoFocus
              className="input"
              placeholder="e.g. Owner, Ali Kakar"
              value={orderedBy}
              onChange={(e) => { setOrderedBy(e.target.value); if (error) setError('') }}
            />
            <p className="mt-1.5 text-xs text-cream-dim">Recorded in the audit trail.</p>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">Reason</label>
            <select className="input py-2.5" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">Notes (optional)</label>
            <textarea
              className="input h-16 resize-none"
              placeholder="Any other details…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">Cancel</button>
            <button
              onClick={confirm}
              className="flex-1 rounded-xl bg-violet-500/90 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              <IconCheck size={18} /> Mark Complimentary
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
