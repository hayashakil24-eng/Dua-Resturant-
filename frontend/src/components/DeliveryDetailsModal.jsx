import { useState } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { IconClose, IconCheck } from './Icons.jsx'

function Field({ label, required, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
        {label} {required && <span className="text-rose-300">*</span>}
      </label>
      {children}
    </div>
  )
}

// Collected once when Delivery is picked as the "table" in POS — rider,
// customer and delivery-charge details a dine-in order has no use for.
// deliveryCharge is informational/printed only, never added to the order
// total (confirmed with the client). onConfirm(details) / onClose().
export default function DeliveryDetailsModal({ initial, onClose, onConfirm }) {
  const [form, setForm] = useState(
    initial || { riderName: '', customerName: '', charge: '', phone: '', address: '', instructions: '' },
  )
  const [error, setError] = useState('')
  useEscapeKey(onClose)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  // Pakistani numbers are 11 digits (03XX-XXXXXXX) — same cap/validation as
  // Employees.jsx's phone field, but mandatory here (delivery needs a real
  // number to call, not an optional one).
  const setPhone = (v) => {
    if (v.replace(/\D/g, '').length > 11) return
    set('phone', v)
  }
  const phoneDigits = form.phone.replace(/\D/g, '')
  const phoneError = phoneDigits.length > 0 && phoneDigits.length !== 11

  const valid =
    form.riderName.trim() &&
    form.customerName.trim() &&
    phoneDigits.length === 11 &&
    form.address.trim() &&
    form.charge !== ''

  const confirm = () => {
    if (!valid) {
      setError(
        phoneDigits.length > 0 && phoneDigits.length !== 11
          ? 'Customer phone number must be exactly 11 digits.'
          : 'Rider name, customer name, delivery charges, phone and address are all required.',
      )
      return
    }
    onConfirm({ ...form, charge: Number(form.charge) || 0 })
  }

  return (
    <div dir="ltr" className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-500/10 text-2xl ring-1 ring-sky-500/25">
                🚗
              </span>
              <div>
                <h3 className="font-serif text-2xl text-cream">Delivery Details</h3>
                <p className="text-xs text-cream-dim">Required before this order can be placed.</p>
              </div>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Rider name" required>
              <input autoFocus className="input" value={form.riderName} onChange={(e) => set('riderName', e.target.value)} placeholder="e.g. Sajid" />
            </Field>

            <Field label="Customer name" required>
              <input className="input" value={form.customerName} onChange={(e) => set('customerName', e.target.value)} placeholder="e.g. Mubashir" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Customer phone" required>
                <input
                  className={`input ${phoneError ? 'border-red-500/70 focus:border-red-500' : ''}`}
                  type="tel"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0300-1234567"
                  aria-invalid={phoneError}
                />
                {phoneError && <p className="mt-1.5 text-[11px] text-red-400">Must be exactly 11 digits.</p>}
              </Field>
              <Field label="Delivery charges" required>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={form.charge}
                  onChange={(e) => set('charge', e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>

            <Field label="Address" required>
              <textarea
                className="input min-h-[70px] resize-none"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Delivery address"
              />
            </Field>

            <Field label="Special instructions">
              <textarea
                className="input min-h-[60px] resize-none"
                value={form.instructions}
                onChange={(e) => set('instructions', e.target.value)}
                placeholder="e.g. No onions, call before arriving"
              />
            </Field>
          </div>

          {error && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              Cancel
            </button>
            <button onClick={confirm} className="btn-gold flex-1 py-3">
              <IconCheck size={18} /> Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
