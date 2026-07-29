import { useState } from 'react'
import { money } from '../utils/format.js'
import { useApp } from '../context/AppContext.jsx'
import { IconCash, IconLogout } from './Icons.jsx'
import { BiLabel } from './ui.jsx'

// Blocking prompt shown to a cashier who has no open shift. They must count the
// cash already in the drawer and enter it as the opening balance before taking
// orders — this is the baseline the end-of-shift count is measured against.
export default function ShiftStartModal({ onStart }) {
  const { logout } = useApp()
  const [opening, setOpening] = useState('')
  const [error, setError] = useState('')

  const amount = Number(opening)

  const submit = async () => {
    if (!opening || Number.isNaN(amount) || amount < 0) {
      return setError('Drawer ka cash likhein.')
    }
    setError('')
    const res = await onStart(amount)
    if (res?.error) setError(res.error)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
              <IconCash size={22} />
            </span>
            <div>
              <h3 className="font-serif text-2xl text-cream">Drawer kholein</h3>
              <p className="text-xs text-cream-dim">
                Shuru mein drawer ka cash gin kar likhein.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
              Shuruati cash (Rs.)
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              autoFocus
              className="input"
              placeholder="misal: 5000"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            {opening && !Number.isNaN(amount) && amount >= 0 && (
              <p className="mt-2 text-[11px] text-cream-dim">
                Shuruati raqam: <span className="text-gold">{money(amount)}</span>
              </p>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
          )}

          <div className="mt-6 flex gap-3">
            <button onClick={logout} className="btn-ghost px-4 py-3 text-sm">
              <IconLogout size={16} /> <BiLabel ur="Log out" />
            </button>
            <button onClick={submit} className="btn-gold flex-1 py-3">
              <IconCash size={18} /> <BiLabel ur="Drawer kholein" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
