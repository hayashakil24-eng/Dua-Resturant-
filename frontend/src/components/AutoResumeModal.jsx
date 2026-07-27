import { useMemo } from 'react'
import { money } from '../utils/format.js'
import { useApp } from '../context/AppContext.jsx'
import { IconCash } from './Icons.jsx'
import { BiLabel } from './ui.jsx'

// Shown on a cashier's login when a paused (still-open) drawer exists — the
// cashier resumes the same shift, or ends it to start fresh. English + LTR to
// match the rest of the cashier flow. `onResume` / `onEndInstead` / `onLogout`
// are provided by Layout. `onLogout` is the escape hatch: the drawer is a
// single global one, so a DIFFERENT cashier logging in lands here on someone
// else's open drawer — without this they'd be trapped (the overlay covers the
// sidebar/header logout) and could only resume or reconcile a drawer not theirs.
export default function AutoResumeModal({ shift, onResume, onEndInstead, onLogout }) {
  const { calculateShiftSales, user } = useApp()
  const sales = useMemo(() => calculateShiftSales(shift.id), [calculateShiftSales, shift.id])
  const expected = sales?.expectedCash ?? shift.openingCash
  // Single global drawer: a DIFFERENT cashier can land here on someone else's
  // open drawer. Make that explicit so they don't resume/close it by mistake.
  const isMine = shift.cashierName === user?.name

  return (
    <div dir="ltr" className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
              <IconCash size={22} />
            </span>
            <div>
              <h3 className="font-serif text-2xl text-cream">
                {isMine ? 'Wapas aa gaye' : 'Drawer pehle se khula hai'}
              </h3>
              <p className="text-xs text-cream-dim">
                {isMine
                  ? `Aap ki shift abhi khuli hai · ${shift.cashierName}, your shift is still open.`
                  : `Ye drawer ${shift.cashierName} ka hai · This drawer belongs to ${shift.cashierName}.`}
              </p>
            </div>
          </div>

          {!isMine && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-2.5 text-[11px] text-amber-200">
              Agar ye aap ka drawer nahi to neeche "Not you? Log out" dabayein · If this isn't
              your drawer, use "Not you? Log out" below.
            </div>
          )}

          {/* Running balance */}
          <div className="mt-5 rounded-2xl border border-gold/25 bg-gold/[0.06] p-5 text-center">
            <p className="text-[11px] uppercase tracking-widest text-gold">Ab tak expected cash · Expected cash so far</p>
            <p className="mt-1 font-serif text-4xl font-semibold text-gold">{money(expected)}</p>
            <p className="mt-2 text-[11px] text-cream-dim">
              Opening {money(shift.openingCash)}
              {sales ? ` + Cash sales ${money(sales.totalCashSales)}` : ''}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button onClick={onResume} className="btn-gold w-full py-3">
              <IconCash size={18} /> <BiLabel ur="Shift jari rakhein" en="Resume shift" />
            </button>
            <button onClick={onEndInstead} className="btn-ghost w-full py-3">
              <BiLabel ur="Ye shift khatam karke nayi shuru karein" en="End this shift & start new" />
            </button>
            <button onClick={onLogout} className="mt-1 text-xs text-cream-dim transition hover:text-cream">
              Aap nahi? Log out · Not you? Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
