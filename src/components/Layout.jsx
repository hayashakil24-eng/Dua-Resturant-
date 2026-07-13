import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Logo from './Logo.jsx'
import { navForRole } from '../config/nav.js'
import { useApp } from '../context/AppContext.jsx'
import { useLang } from '../i18n/LanguageContext.jsx'

// Routes translated to Urdu (admin panel). Operational pages used by
// cashiers/waiters (POS, Orders, Billing) stay English + LTR even in Urdu mode,
// so only these get RTL when the language is Urdu.
const RTL_ROUTES = new Set([
  '/',
  '/tables',
  '/menu',
  '/departments',
  '/inventory',
  '/attendance',
  '/employees',
  '/payroll',
  '/accounting',
  '/reports',
  '/receivables',
  '/kitchen',
])
import { dateLong } from '../utils/format.js'
import { IconLogout, IconMenu, IconClose, IconCash } from './Icons.jsx'
import ShiftStartModal from './ShiftStartModal.jsx'
import ShiftEndModal from './ShiftEndModal.jsx'
import AutoResumeModal from './AutoResumeModal.jsx'
import PartialHandoverModal from './PartialHandoverModal.jsx'

// EN ⇄ اردو toggle. Flips the whole app to RTL + Urdu font via <html dir>.
function LanguageSwitcher() {
  const { lang, setLang } = useLang()
  return (
    <div className="flex overflow-hidden rounded-full border border-ink-line text-xs font-semibold">
      {[
        ['en', 'EN'],
        ['ur', 'اردو'],
      ].map(([code, label]) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={`px-2.5 py-1.5 transition ${
            lang === code ? 'bg-gold/15 text-gold' : 'text-cream-dim hover:text-cream'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function SidebarLinks({ role, onNavigate }) {
  const { t } = useLang()
  const items = navForRole(role)
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ to, label, labelKey, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isActive
                ? 'bg-gold/12 text-gold-deep ring-1 ring-gold/25'
                : 'text-cream-dim hover:bg-white/5 hover:text-cream'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`shrink-0 transition ${isActive ? 'text-gold-deep' : 'text-cream-dim group-hover:text-cream'}`}
              >
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1 truncate">{t(labelKey, label)}</span>
              {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

// `exitTitle` labels the exit button. For cashiers with an open drawer it reads
// "End Shift & Log out" and routes through reconciliation (no bypass); everyone
// else gets a plain logout.
function UserCard({ user, onExit, exitTitle = 'Log out' }) {
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
        onClick={onExit}
        title={exitTitle}
        className="grid h-9 w-9 place-items-center rounded-lg text-cream-dim transition hover:bg-white/5 hover:text-rose-300"
      >
        <IconLogout size={18} />
      </button>
    </div>
  )
}

export default function Layout({ children }) {
  const { user, logout, activeShift, startShift, pauseShift, resumeShift, endShift, calculateShiftSales, initiateHandover } = useApp()
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [exitChoice, setExitChoice] = useState(false)
  const [handoverOpen, setHandoverOpen] = useState(false)
  const [resumed, setResumed] = useState(false) // resume prompt handled this session
  const location = useLocation()

  // Content direction is per-route: only translated admin pages flip to RTL in
  // Urdu; operational pages stay LTR. The sidebar/header chrome follows the
  // global <html dir> (Urdu = RTL) regardless.
  const contentDir = lang === 'ur' && RTL_ROUTES.has(location.pathname) ? 'rtl' : 'ltr'

  // Cashiers run against an open cash drawer. On login: no drawer → prompt for
  // opening cash; a persisted (paused) drawer → offer to resume it.
  const isCashier = user.role === 'Cashier'
  const hasOpenDrawer = isCashier && Boolean(activeShift)
  const needsShiftStart = isCashier && !activeShift
  const needsResume = hasOpenDrawer && !resumed

  // Opening a fresh drawer counts as "handled" so the resume prompt won't fire.
  const beginShift = (openingCash) => {
    startShift(openingCash)
    setResumed(true)
  }

  const finishShift = (shiftId, actual, handover) => {
    endShift(shiftId, actual, handover)
    setEndOpen(false)
    logout() // shift closed → sign the cashier out, back to login
  }

  // Exit: a cashier with an open drawer chooses Pause (keep drawer, resume later)
  // or End Shift (reconcile + close). Everyone else just logs out.
  const handleExit = () => {
    setOpen(false)
    if (hasOpenDrawer) setExitChoice(true)
    else logout()
  }
  const pauseAndLogout = () => {
    pauseShift()
    setExitChoice(false)
    logout()
  }
  const exitTitle = t('app.logout')

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-52 flex-col border-e border-ink-line bg-ink-soft/70 p-4 backdrop-blur lg:flex">
        <div className="px-1">
          <Logo />
        </div>
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <p className="mb-2 px-3 text-[10px] uppercase tracking-[0.25em] text-cream-dim">
            {t('app.menuHeading')}
          </p>
          <SidebarLinks role={user.role} />
        </div>
        <div className="mt-4 shrink-0">
          <UserCard user={user} onExit={handleExit} exitTitle={exitTitle} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 start-0 flex w-72 flex-col border-e border-ink-line bg-ink-soft p-5">
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
              <UserCard user={user} onExit={handleExit} exitTitle={exitTitle} />
            </div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:ps-52">
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
          <div className="ms-auto flex items-center gap-3">
            <LanguageSwitcher />
            {isCashier && activeShift && (
              <>
                <button
                  onClick={() => setHandoverOpen(true)}
                  className="hidden items-center gap-1.5 rounded-full border border-ink-line bg-ink-soft px-3 py-1.5 text-xs font-semibold text-cream-dim transition hover:text-cream sm:inline-flex"
                >
                  💸 Hand over
                </button>
                <button
                  onClick={handleExit}
                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
                >
                  <IconCash size={14} /> {t('app.logout')}
                </button>
              </>
            )}
            <span className="hidden rounded-full border border-ink-line bg-ink-soft px-3 py-1.5 text-xs text-cream-dim sm:inline">
              {t('app.signedInAs')} <span className="text-gold">{user.role}</span>
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gold-grad text-sm font-semibold text-ink lg:hidden">
              {user.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </div>
          </div>
        </header>

        <main key={location.pathname} dir={contentDir} className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Cash drawer lifecycle */}
      {needsShiftStart && <ShiftStartModal onStart={beginShift} />}

      {/* Resume a paused drawer on login */}
      {needsResume && !endOpen && (
        <AutoResumeModal
          shift={activeShift}
          onResume={() => {
            resumeShift()
            setResumed(true)
          }}
          onEndInstead={() => {
            setResumed(true)
            setEndOpen(true)
          }}
        />
      )}

      {isCashier && activeShift && endOpen && (
        <ShiftEndModal
          shift={activeShift}
          onClose={() => setEndOpen(false)}
          onComplete={finishShift}
        />
      )}

      {/* Cashier: mid-shift partial handover (pending manager approval) */}
      {isCashier && activeShift && handoverOpen && (
        <PartialHandoverModal
          current={calculateShiftSales(activeShift.id)?.expectedCash ?? activeShift.openingCash}
          onClose={() => setHandoverOpen(false)}
          onSubmit={(data) => {
            const res = initiateHandover(data)
            if (res?.error) return
            setHandoverOpen(false)
          }}
        />
      )}

      {/* Exit choice — pause (keep drawer) vs end shift (reconcile) */}
      {exitChoice && (
        <div dir="ltr" className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setExitChoice(false)} />
          <div className="relative z-10 w-full max-w-sm animate-fade-up">
            <div className="card p-6">
              <h3 className="font-serif text-2xl text-cream">Log out</h3>
              <p className="mt-1 text-xs text-cream-dim">
                Pause keeps your drawer open to resume later. End shift counts the
                cash and closes the drawer.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button onClick={pauseAndLogout} className="btn-ghost w-full py-3">
                  ⏸ Pause &amp; Log out
                </button>
                <button
                  onClick={() => {
                    setExitChoice(false)
                    setEndOpen(true)
                  }}
                  className="btn-gold w-full py-3"
                >
                  <IconCash size={18} /> End Shift &amp; Reconcile
                </button>
                <button onClick={() => setExitChoice(false)} className="mt-1 text-xs text-cream-dim hover:text-cream">
                  Cancel · Keep working
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
