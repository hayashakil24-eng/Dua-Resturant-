import { useState } from 'react'
import { money } from '../utils/format.js'
import { IconClose, IconCheck } from './Icons.jsx'

// Round up to the next multiple of `step` (for quick-cash suggestions).
const roundUp = (n, step) => Math.ceil(n / step) * step

// Shared payment dialog used by the POS "Pay Now" flow and the Orders page
// "Mark as Paid" action. `onConfirm(method, tendered, account)` reports the
// chosen method (Cash/Card/Online), the amount tendered (cash), and — for an
// online payment — the destination account it landed in.
// `onlineAccounts` is the Admin-managed list from Settings; only the ACTIVE ones
// are offered. Forced dir="ltr" so it renders identically on the RTL (Urdu) pages.
export default function PaymentModal({ total, onClose, onConfirm, onlineAccounts = [] }) {
  const activeAccounts = onlineAccounts.filter((a) => a.active)
  const [method, setMethod] = useState('Cash')
  const [tendered, setTendered] = useState('')
  const [accountId, setAccountId] = useState(activeAccounts[0]?.id || '')

  const isCash = method === 'Cash'
  const isOnline = method === 'Online'
  const selectedAccount = activeAccounts.find((a) => a.id === accountId) || null
  const tenderedNum = Number(tendered) || 0
  const change = tenderedNum - total
  // Online requires picking which account received the money (no amount checks).
  const canConfirm = (!isCash || tenderedNum >= total) && (!isOnline || Boolean(selectedAccount))

  // Handy cash denominations at or above the bill total.
  const suggestions = [
    ...new Set([total, roundUp(total, 100), roundUp(total, 500), roundUp(total, 1000)]),
  ]
    .filter((v) => v >= total)
    .slice(0, 4)

  const confirm = () => {
    if (!canConfirm) return
    onConfirm(method, isCash ? tenderedNum : total, isOnline ? selectedAccount : null)
  }

  return (
    <div dir="ltr" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">Take Payment</h3>
              <p className="mt-0.5 text-xs text-cream-dim">Select method and collect the amount due.</p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          {/* Amount due */}
          <div className="mt-5 rounded-2xl border border-gold/25 bg-gold/[0.06] p-5 text-center">
            <p className="text-[11px] uppercase tracking-widest text-gold">Amount due</p>
            <p className="mt-1 font-serif text-4xl font-semibold text-gold">{money(total)}</p>
          </div>

          {/* Method */}
          <div className="mt-5">
            <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
              Payment method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['Cash', 'Card', 'Online'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                    method === m
                      ? 'border-gold/50 bg-gold/12 text-gold'
                      : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Cash tendered + change */}
          {isCash && (
            <div className="mt-5">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                Cash received
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                autoFocus
                className="input"
                placeholder="Enter amount received…"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((v) => (
                  <button
                    key={v}
                    onClick={() => setTendered(String(v))}
                    className="rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 text-xs font-medium text-cream-dim transition hover:border-gold/40 hover:text-cream"
                  >
                    {money(v)}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-ink-line bg-ink-soft px-4 py-3">
                <span className="text-sm text-cream-dim">
                  {change >= 0 ? 'Change due' : 'Remaining'}
                </span>
                <span
                  className={`font-serif text-2xl font-semibold ${
                    change >= 0 ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {money(Math.abs(change))}
                </span>
              </div>
            </div>
          )}

          {/* Online → which account received the payment (Admin-managed list) */}
          {isOnline && (
            <div className="mt-5">
              <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
                Received in account
              </label>
              {activeAccounts.length === 0 ? (
                <p className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-3 py-2.5 text-xs text-rose-300">
                  No active online accounts. An Admin can add one in Settings → Online Payment Accounts.
                </p>
              ) : (
                <>
                  <select
                    className="input"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  >
                    {activeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {a.type ? ` · ${a.type}` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedAccount?.number && (
                    <p className="mt-1.5 text-xs text-cream-dim">
                      {selectedAccount.type} · {selectedAccount.number}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={!canConfirm}
              className="btn-gold flex-1 py-3 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconCheck size={18} /> Confirm {money(total)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
