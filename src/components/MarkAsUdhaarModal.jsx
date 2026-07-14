import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { money } from '../utils/format.js'
import { tableLabel } from '../data/mockData.js'
import { IconClose, IconWallet } from './Icons.jsx'

// Put an unpaid order "on account" (udhaar). The bill is added to a customer's
// Receivable — an existing open account or a new one. English + LTR to match
// the Orders/POS operational flow. onConfirm({ accountId, customerName }).
export default function MarkAsUdhaarModal({ order, onClose, onConfirm }) {
  const { orderTotal, receivables } = useApp()
  const total = orderTotal(order.items, order.discount?.amount).total
  const openAccounts = useMemo(() => receivables.filter((r) => r.status !== 'settled'), [receivables])

  const [mode, setMode] = useState(openAccounts.length ? 'existing' : 'new')
  const [accountId, setAccountId] = useState(openAccounts[0]?.id || '')
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const confirm = () => {
    if (mode === 'existing') {
      if (!accountId) return setError('Select a customer account.')
      return onConfirm({ accountId, customerName: '' })
    }
    if (!name.trim()) return setError('Customer name is required.')
    onConfirm({ accountId: '', customerName: name.trim() })
  }

  return (
    <div dir="ltr" className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/25">
                <IconWallet size={22} />
              </span>
              <div>
                <h3 className="font-serif text-2xl text-cream">Mark as Udhaar</h3>
                <p className="text-xs text-cream-dim">Put this bill on a customer's account (credit).</p>
              </div>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          {/* Bill */}
          <div className="mt-5 rounded-2xl border border-ink-line bg-ink-soft p-4 text-center">
            <p className="text-[11px] uppercase tracking-widest text-gold">Bill amount</p>
            <p className="mt-1 font-serif text-3xl font-semibold text-gold">{money(total)}</p>
            <p className="mt-1 text-xs text-cream-dim">
              {order.id} · {tableLabel(order.table)}
            </p>
          </div>

          {/* Account choice */}
          {openAccounts.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setMode('existing'); setError('') }}
                className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                  mode === 'existing' ? 'border-gold/50 bg-gold/12 text-gold' : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                }`}
              >
                Existing account
              </button>
              <button
                type="button"
                onClick={() => { setMode('new'); setError('') }}
                className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                  mode === 'new' ? 'border-gold/50 bg-gold/12 text-gold' : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                }`}
              >
                New customer
              </button>
            </div>
          )}

          {mode === 'existing' && openAccounts.length > 0 ? (
            <div className="mt-4">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">Customer account</label>
              <select className="input py-2.5" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {openAccounts.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {money(r.balance)} due
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-cream-dim">The bill is added to this account's outstanding balance.</p>
            </div>
          ) : (
            <div className="mt-4">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                Customer name <span className="text-rose-300">*</span>
              </label>
              <input
                autoFocus
                className="input"
                placeholder="e.g. Ali Bhai, Shahid Sahab"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-cream-dim">Recorded so the due can be collected later.</p>
            </div>
          )}

          {error && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">Cancel</button>
            <button onClick={confirm} className="btn-gold flex-1 py-3">
              <IconWallet size={18} /> Confirm Udhaar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
