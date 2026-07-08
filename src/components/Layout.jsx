import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Logo from './Logo.jsx'
import { navForRole } from '../config/nav.js'
import { useApp } from '../context/AppContext.jsx'
import { dateLong } from '../utils/format.js'
import { IconLogout, IconMenu, IconClose } from './Icons.jsx'

function SidebarLinks({ role, onNavigate }) {
  const items = navForRole(role)
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition ${
              isActive
                ? 'bg-gold/12 text-gold ring-1 ring-gold/25'
                : 'text-cream-dim hover:bg-white/5 hover:text-cream'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`transition ${isActive ? 'text-gold' : 'text-cream-dim group-hover:text-cream'}`}
              >
                <Icon size={20} />
              </span>
              {label}
              {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function UserCard({ user, onLogout }) {
  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
  return (
    <div className="card flex items-center gap-3 p-3">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-gold-grad font-semibold text-ink">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-cream">{user.name}</p>
        <p className="text-xs text-gold">{user.role}</p>
      </div>
      <button
        onClick={onLogout}
        title="Logout"
        className="grid h-9 w-9 place-items-center rounded-lg text-cream-dim transition hover:bg-white/5 hover:text-rose-300"
      >
        <IconLogout size={18} />
      </button>
    </div>
  )
}

export default function Layout({ children }) {
  const { user, logout } = useApp()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-ink-line bg-ink-soft/70 p-5 backdrop-blur lg:flex">
        <div className="px-1">
          <Logo />
        </div>
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <p className="mb-2 px-3 text-[10px] uppercase tracking-[0.25em] text-cream-dim/70">
            Menu
          </p>
          <SidebarLinks role={user.role} />
        </div>
        <div className="mt-4 shrink-0">
          <UserCard user={user} onLogout={logout} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-ink-line bg-ink-soft p-5">
            <div className="flex items-center justify-between">
              <Logo />
              <button
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-cream-dim hover:bg-white/5"
              >
                <IconClose size={20} />
              </button>
            </div>
            <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
              <SidebarLinks role={user.role} onNavigate={() => setOpen(false)} />
            </div>
            <div className="mt-4 shrink-0">
              <UserCard user={user} onLogout={logout} />
            </div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-72">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-ink-line bg-ink/80 px-4 py-3 backdrop-blur sm:px-6">
          <button
            onClick={() => setOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-ink-line text-cream-dim transition hover:text-cream lg:hidden"
          >
            <IconMenu size={20} />
          </button>
          <div className="hidden sm:block">
            <p className="text-xs text-cream-dim">{dateLong()}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden rounded-full border border-ink-line bg-ink-soft px-3 py-1.5 text-xs text-cream-dim sm:inline">
              Signed in as <span className="text-gold">{user.role}</span>
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gold-grad text-sm font-semibold text-ink lg:hidden">
              {user.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </div>
          </div>
        </header>

        <main key={location.pathname} className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
