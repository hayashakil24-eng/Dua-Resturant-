import Logo from '../components/Logo.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useLang } from '../i18n/LanguageContext.jsx'

// Landing page for a self-signup account with role 'Pending' — see
// App.jsx's Protected wrapper, which redirects every other route here for
// this role. No polling/live-update: the account just needs to log back in
// once an Admin has approved or rejected it from /approvals.
export default function PendingApproval() {
  const { user, logout } = useApp()
  const { t } = useLang()

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-gold/5 blur-3xl" />

      <div className="w-full max-w-md rounded-3xl border border-ink-line bg-ink-card/70 p-10 text-center shadow-lift backdrop-blur">
        <div className="flex justify-center">
          <Logo size={52} />
        </div>
        <h1 className="mt-6 font-serif text-2xl font-semibold text-cream">{t('pendingApproval.title')}</h1>
        <p className="mt-3 text-sm text-cream-dim">
          {t('pendingApproval.body').replace('{name}', user?.name || '')}
        </p>
        <button onClick={logout} className="btn-gold mt-8 w-full py-3 text-base">
          {t('pendingApproval.logout')}
        </button>
      </div>
    </div>
  )
}
