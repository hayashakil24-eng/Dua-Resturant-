// Small shared presentational components
import { useT } from '../i18n/LanguageContext.jsx'

export function PaymentBadge({ status }) {
  const t = useT()
  const paid = status === 'Paid'
  return (
    <span
      className={`badge ${
        paid
          ? 'bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/30'
          : 'bg-amber-500/12 text-amber-300 ring-1 ring-amber-500/30'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${paid ? 'bg-emerald-400' : 'bg-amber-400'}`}
      />
      {t(paid ? 'status.paid' : 'status.unpaid', status)}
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
  return (
    <span className={`badge ring-1 ${ATT_STYLES[status] || 'bg-white/5 text-cream-dim ring-white/10'}`}>
      {status}
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
