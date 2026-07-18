import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import { useApp } from '../context/AppContext.jsx'

export default function Login() {
  const { login } = useApp()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    const res = await login({ username: username.trim(), password })
    setSubmitting(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    // Login stays English + LTR regardless of the saved language preference.
    <div dir="ltr" className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-gold/5 blur-3xl" />

      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-ink-line bg-ink-card/70 shadow-lift backdrop-blur lg:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden flex-col justify-between border-r border-ink-line bg-gradient-to-b from-ink-soft to-ink p-10 lg:flex">
          <Logo size={52} />
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gold">Fine Dining · Est. 2019</p>
            <h2 className="mt-4 font-serif text-4xl font-semibold leading-tight text-cream">
              Where every plate
              <br />
              tells a <span className="text-gold-gradient">golden</span> story.
            </h2>
            <p className="mt-4 max-w-sm text-sm text-cream-dim">
              The complete management suite for Cafe Ali — orders, tables,
              billing and staff, refined into one elegant workspace.
            </p>
          </div>
          <div className="flex gap-8 text-cream">
            {[
              ['12', 'Tables'],
              ['18', 'Menu items'],
              ['8', 'Staff'],
            ].map(([n, l]) => (
              <div key={l}>
                <p className="font-serif text-2xl text-gold">{n}</p>
                <p className="text-xs text-cream-dim">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Form panel */}
        <div className="p-8 sm:p-10">
          <div className="mb-8 lg:hidden">
            <Logo size={48} />
          </div>
          <h1 className="font-serif text-3xl font-semibold text-cream">Welcome back</h1>
          <p className="mt-1 text-sm text-cream-dim">Sign in to your workspace to continue.</p>

          <form onSubmit={submit} className="mt-8 space-y-6">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-widest text-cream-dim">Username</label>
              <input
                className="input"
                placeholder="e.g. admin"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-widest text-cream-dim">Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
            )}

            <button type="submit" disabled={submitting} className="btn-gold w-full py-3 text-base disabled:opacity-60">
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="text-center text-[11px] text-cream-dim">
              Demo logins: admin · manager · cashier · kitchen (password 1234)
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
