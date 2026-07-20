import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useLang } from '../i18n/LanguageContext.jsx'

// Mirrors Login.jsx's layout/classes deliberately, unlike Login itself this
// page uses i18n normally — Login's hardcoded English is a one-off exception
// documented there, not a pattern to repeat.
export default function Signup() {
  const { signup } = useApp()
  const { t } = useLang()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setError('')
    if (!name.trim() || !username.trim() || !password) {
      setError(t('signup.errorRequired'))
      return
    }
    if (password !== confirm) {
      setError(t('signup.errorMismatch'))
      return
    }
    setSubmitting(true)
    const res = await signup({ name: name.trim(), username: username.trim(), password })
    setSubmitting(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    setDone(true)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-gold/5 blur-3xl" />

      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-ink-line bg-ink-card/70 shadow-lift backdrop-blur lg:grid-cols-2">
        <div className="relative hidden flex-col justify-between border-r border-ink-line bg-gradient-to-b from-ink-soft to-ink p-10 lg:flex">
          <Logo size={52} />
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gold">{t('signup.brandTagline')}</p>
            <h2 className="mt-4 font-serif text-4xl font-semibold leading-tight text-cream">
              {t('signup.brandHeadlineA')}
              <br />
              {t('signup.brandHeadlineB')}
            </h2>
            <p className="mt-4 max-w-sm text-sm text-cream-dim">{t('signup.brandBody')}</p>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="mb-8 lg:hidden">
            <Logo size={48} />
          </div>

          {done ? (
            <div className="flex min-h-[300px] flex-col justify-center">
              <h1 className="font-serif text-3xl font-semibold text-cream">{t('signup.doneTitle')}</h1>
              <p className="mt-3 text-sm text-cream-dim">{t('signup.doneBody')}</p>
              <Link to="/login" className="btn-gold mt-6 inline-block w-full py-3 text-center text-base">
                {t('signup.goToLogin')}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-serif text-3xl font-semibold text-cream">{t('signup.title')}</h1>
              <p className="mt-1 text-sm text-cream-dim">{t('signup.subtitle')}</p>

              <form onSubmit={submit} className="mt-8 space-y-5">
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-widest text-cream-dim">{t('signup.name')}</label>
                  <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-widest text-cream-dim">{t('signup.username')}</label>
                  <input className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-widest text-cream-dim">{t('signup.password')}</label>
                  <input
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-widest text-cream-dim">{t('signup.confirmPassword')}</label>
                  <input
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>

                {error && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
                )}

                <button type="submit" disabled={submitting} className="btn-gold w-full py-3 text-base disabled:opacity-60">
                  {submitting ? t('signup.submitting') : t('signup.submit')}
                </button>
                <p className="text-center text-[11px] text-cream-dim">
                  {t('signup.haveAccount')} <Link to="/login" className="text-gold hover:underline">{t('signup.signInLink')}</Link>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
