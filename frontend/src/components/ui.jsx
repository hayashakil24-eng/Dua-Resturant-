// Small shared presentational components
import { useState } from 'react'
import { useT } from '../i18n/LanguageContext.jsx'
import { IconEye, IconEyeOff } from './Icons.jsx'

// A password field with its own reveal toggle. Every password input in the app
// goes through this rather than hand-rolling the toggle per field, so the icon
// can never end up inverted on one screen and correct on another.
//
// The icon reflects the CURRENT state, not the pending action:
//   masked (••••)  → slashed eye  ("this is hidden")
//   revealed (abc) → open eye     ("this is visible")
// The aria-label carries the action instead, which is what a screen reader
// needs. Browsers add their own reveal control too (Edge's ::-ms-reveal); that
// one is hidden in index.css so there is never a second, conflicting eye.
export function PasswordInput({ className = 'input', ...props }) {
  const t = useT()
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={revealed ? 'text' : 'password'} className={`${className} pe-11`} />
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        // Keeps focus in the field: the toggle is an aid while typing, so
        // stealing focus on click would break the flow into the next field.
        onMouseDown={(e) => e.preventDefault()}
        tabIndex={-1}
        aria-label={revealed ? t('common.hidePassword') : t('common.showPassword')}
        title={revealed ? t('common.hidePassword') : t('common.showPassword')}
        className="absolute end-3 top-1/2 -translate-y-1/2 text-cream-dim transition hover:text-cream"
      >
        {revealed ? <IconEye size={18} /> : <IconEyeOff size={18} />}
      </button>
    </div>
  )
}

// Label for cashier action buttons. Roman Urdu only, independent of the
// app-language toggle — the staff running a drawer read Roman Urdu, and the
// client asked for the English subline to go. Kept LTR (no Urdu script) on
// purpose: the cashier flow modals are LTR and Roman Urdu avoids RTL churn.
export function BiLabel({ ur }) {
  return <span className="text-sm font-semibold leading-tight">{ur}</span>
}

export function PaymentBadge({ status }) {
  const t = useT()
  // Four states: Paid (emerald), Udhaar/on-account (sky), Complimentary/free
  // (violet), Unpaid (amber).
  const tone =
    status === 'Paid'
      ? { badge: 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/30', dot: 'bg-emerald-400' }
      : status === 'Udhaar'
        ? { badge: 'bg-sky-500/12 text-sky-300 ring-sky-500/30', dot: 'bg-sky-400' }
        : status === 'Complimentary'
          ? { badge: 'bg-violet-500/12 text-violet-300 ring-violet-500/30', dot: 'bg-violet-400' }
          : { badge: 'bg-amber-500/12 text-amber-300 ring-amber-500/30', dot: 'bg-amber-400' }
  const label =
    status === 'Paid'
      ? t('status.paid', 'Paid')
      : status === 'Udhaar'
        ? t('status.udhaar', 'Udhaar')
        : status === 'Complimentary'
          ? t('status.complimentary', 'Complimentary')
          : t('status.unpaid', 'Unpaid')
  return (
    <span className={`badge ring-1 ${tone.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {label}
    </span>
  )
}

const ATT_STYLES = {
  Present: 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/30',
  Late: 'bg-amber-500/12 text-amber-300 ring-amber-500/30',
  'Checked Out': 'bg-sky-500/12 text-sky-300 ring-sky-500/30',
  Absent: 'bg-rose-500/12 text-rose-300 ring-rose-500/30',
}

export function StatusBadge({ status }) {
  const t = useT()
  return (
    <span className={`badge ring-1 ${ATT_STYLES[status] || 'bg-white/5 text-cream-dim ring-white/10'}`}>
      {t(`attStatus.${status}`, status)}
    </span>
  )
}

export function StatCard({ icon: Icon, label, value, sub, delay = 0 }) {
  return (
    <div
      className="card group relative overflow-hidden p-5 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gold/10 blur-2xl transition group-hover:bg-gold/20" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-cream-dim">{label}</p>
          <p className="mt-2 font-serif text-3xl font-semibold text-cream">{value}</p>
          {sub && <p className="mt-1 text-xs text-cream-dim">{sub}</p>}
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-cream sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-cream-dim">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="card grid place-items-center gap-3 p-12 text-center">
      {Icon && (
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gold/10 text-gold ring-1 ring-gold/20">
          <Icon size={26} />
        </div>
      )}
      <p className="font-serif text-xl text-cream">{title}</p>
      {hint && <p className="max-w-sm text-sm text-cream-dim">{hint}</p>}
    </div>
  )
}
