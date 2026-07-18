import { useMemo } from 'react'
import { money } from '../utils/format.js'
import { useApp } from '../context/AppContext.jsx'
import { IconCash } from './Icons.jsx'

// Shown on a cashier's login when a paused (still-open) drawer exists — the
// cashier resumes the same shift, or ends it to start fresh. English + LTR to
// match the rest of the cashier flow. `onResume` / `onEndInstead` are provided
// by Layout.
export default function AutoResumeModal({ shift, onResume, onEndInstead }) {
  const { calculateShiftSales } = useApp()
  const sales = useMemo(() => calculateShiftSales(shift.id), [calculateShiftSales, shift.id])
  const expected = sales?.expectedCash ?? shift.openingCash

  return (
    <div dir="ltr" className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
              <IconCash size={22} />
            </span>
            <div>
              <h3 className="font-serif text-2xl text-cream">Welcome back</h3>
              <p className="text-xs text-cream-dim">
                {shift.cashierName}, your shift is still open.
              </p>
            </div>
          </div>

          {/* Running balance */}
          <div className="mt-5 rounded-2xl border border-gold/25 bg-gold/[0.06] p-5 text-center">
            <p className="text-[11px] uppercase tracking-widest text-gold">Expected cash so far</p>
            <p className="mt-1 font-serif text-4xl font-semibold text-gold">{money(expected)}</p>
            <p className="mt-2 text-[11px] text-cream-dim">
              Opening {money(shift.openingCash)}
              {sales ? ` + Cash sales ${money(sales.totalCashSales)}` : ''}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button onClick={onResume} className="btn-gold w-full py-3">
              <IconCash size={18} /> Resume shift
            </button>
            <button onClick={onEndInstead} className="btn-ghost w-full py-2.5 text-sm">
              End this shift & start new
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
