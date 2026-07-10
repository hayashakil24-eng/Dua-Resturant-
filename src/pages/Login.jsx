import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import { useApp } from '../context/AppContext.jsx'
import { ROLES } from '../data/mockData.js'
import { IconDashboard, IconCash, IconUsers } from '../components/Icons.jsx'

const ROLE_META = {
  Admin: { icon: IconDashboard, desc: 'Full access · all modules & reports' },
  Manager: { icon: IconUsers, desc: 'Operations · orders, staff & attendance' },
  Cashier: { icon: IconCash, desc: 'POS · billing & receipts' },
}

export default function Login() {
  const { login } = useApp()
  const navigate = useNavigate()
  const [role, setRole] = useState('Admin')
  const [name, setName] = useState('')

  const submit = (e) => {
    e.preventDefault()
    login({ role, name: name.trim() })
    navigate('/', { replace: true })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
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
              <label className="mb-2 block text-xs uppercase tracking-widest text-cream-dim">
                Select your role
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {ROLES.map((r) => {
                  const Meta = ROLE_META[r]
                  const active = role === r
                  return (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setRole(r)}
                      className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
                        active
                          ? 'border-gold/60 bg-gold/10 shadow-gold'
                          : 'border-ink-line bg-ink-soft hover:border-gold/30'
                      }`}
                    >
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-lg ${
                          active ? 'bg-gold-grad text-ink' : 'bg-white/5 text-cream-dim'
                        }`}
                      >
                        <Meta.icon size={18} />
                      </span>
                      <span className={`text-sm font-semibold ${active ? 'text-gold' : 'text-cream'}`}>
                        {r}
                      </span>
                      <span className="text-[11px] leading-snug text-cream-dim">{Meta.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-widest text-cream-dim">
                Display name <span className="text-cream-dim/50">(optional)</span>
              </label>
              <input
                className="input"
                placeholder={`e.g. ${role} User`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-widest text-cream-dim">
                Password
              </label>
              <input className="input" type="password" placeholder="••••••••" defaultValue="demo" />
              <p className="mt-2 text-[11px] text-cream-dim/70">
                Demo build — any password works.
              </p>
            </div>

            <button type="submit" className="btn-gold w-full py-3 text-base">
              Sign in as {role}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
