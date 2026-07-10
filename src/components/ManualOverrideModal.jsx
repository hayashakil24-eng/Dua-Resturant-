import { useState } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { IconClose, IconClock } from './Icons.jsx'

const REASONS = [
  'Machine Malfunction',
  'Machine Offline (No Internet)',
  'Employee Forgot to Punch',
  'Fingerprint Not Recognized',
  'Correction (Wrong Machine Entry)',
  'Other',
]

// ISO timestamp -> "HH:MM" for a <input type="time">
const toTimeInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// "HH:MM" -> ISO timestamp anchored to today
const fromTimeInput = (hhmm) => {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

// Admin-only emergency tool. Normal attendance comes from the biometric
// machine and is read-only; this exists for machine failures. A reason is
// mandatory and every save is written to the audit trail + tagged "Manual".
export default function ManualOverrideModal({ staff, record, onSave, onClose }) {
  const [checkInTime, setCheckInTime] = useState(toTimeInput(record?.checkIn))
  const [checkOutTime, setCheckOutTime] = useState(toTimeInput(record?.checkOut))
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  useEscapeKey(onClose)

  const submit = () => {
    if (!reason) return setError('A reason is mandatory for a manual entry.')
    if (!checkInTime && !checkOutTime)
      return setError('Enter at least a check-in or check-out time.')
    if (checkInTime && checkOutTime && checkOutTime < checkInTime)
      return setError('Check-out cannot be earlier than check-in.')
    setError('')
    onSave({
      checkIn: fromTimeInput(checkInTime),
      checkOut: fromTimeInput(checkOutTime),
      reason,
      notes: notes.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">Manual Override</h3>
              <p className="mt-0.5 text-xs text-cream-dim">
                {staff?.name} · {staff?.id}
              </p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          {/* Emergency-only warning */}
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-3 text-xs text-amber-200">
            For emergency use only (e.g. machine malfunction). This entry is
            logged to the audit trail and marked <strong>Manual Entry</strong>.
          </div>

          {/* Times */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                Check-in
              </label>
              <input
                type="time"
                className="input"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                Check-out
              </label>
              <input
                type="time"
                className="input"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
              />
            </div>
          </div>

          {/* Reason (mandatory) */}
          <div className="mt-4">
            <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
              Reason <span className="text-rose-400">*</span>
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
              placeholder="e.g. Biometric reader was offline all morning"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              Cancel
            </button>
            <button onClick={submit} className="btn-gold flex-1 py-3">
              <IconClock size={18} /> Save Manual Entry
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
