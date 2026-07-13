import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useLang } from '../i18n/LanguageContext.jsx'
import { money } from '../utils/format.js'
import { IconClose, IconPlus, IconMinus, IconSearch } from '../components/Icons.jsx'

// Assign / remove menu items for a single department (counter). Assigning an
// item MOVES it off any other counter (handled in AppContext) so routing stays
// unambiguous — the "already on <counter>" hint makes that visible here.
export default function ItemAssignmentModal({ department, onClose }) {
  const { menu, departments, assignItemToDepartment, removeItemFromDepartment, getDepartmentForItem } = useApp()
  const { t, lang } = useLang()
  const [query, setQuery] = useState('')

  const assigned = useMemo(
    () => department.items.map((id) => menu.find((m) => m.id === id)).filter(Boolean),
    [department.items, menu],
  )

  // Available = everything not on THIS counter, matching the search.
  const available = useMemo(() => {
    const q = query.trim().toLowerCase()
    return menu
      .filter((m) => !department.items.includes(m.id))
      .filter((m) => !q || m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q))
  }, [menu, department.items, query])

  const otherDeptName = (id) => {
    const d = getDepartmentForItem(id)
    return d && d.id !== department.id ? (lang === 'ur' && d.nameUrdu ? d.nameUrdu : d.name) : null
  }

  return (
    <div dir={lang === 'ur' ? 'rtl' : 'ltr'} className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col animate-fade-up">
        <div className="card flex min-h-0 flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-serif text-xl text-cream">
                {t('departments.assignTitle')}
              </h2>
              <p className="truncate text-sm text-gold">
                {lang === 'ur' && department.nameUrdu ? department.nameUrdu : department.name}
              </p>
            </div>
            <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-line text-cream-dim hover:text-cream">
              <IconClose size={18} />
            </button>
          </div>

          <div className="mt-4 grid min-h-0 flex-1 gap-4 sm:grid-cols-2">
            {/* Assigned */}
            <div className="flex min-h-0 flex-col rounded-xl border border-ink-line bg-white/[0.02] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold">
                {t('departments.assigned')} ({assigned.length})
              </p>
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                {assigned.length === 0 && <p className="text-xs text-cream-dim">{t('departments.noAssigned')}</p>}
                {assigned.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                    <span className="min-w-0 truncate text-sm text-cream">{m.name}</span>
                    <button
                      onClick={() => removeItemFromDepartment(m.id, department.id)}
                      title={t('departments.remove')}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-rose-500/15 text-rose-300 transition hover:bg-rose-500/25"
                    >
                      <IconMinus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Available */}
            <div className="flex min-h-0 flex-col rounded-xl border border-ink-line bg-white/[0.02] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cream-dim">
                {t('departments.available')}
              </p>
              <div className="relative mb-2">
                <span className="pointer-events-none absolute inset-y-0 start-2.5 grid place-items-center text-cream-dim">
                  <IconSearch size={15} />
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('departments.searchPh')}
                  className="input py-1.5 ps-8 text-sm"
                />
              </div>
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                {available.length === 0 && <p className="text-xs text-cream-dim">{t('departments.noneAvailable')}</p>}
                {available.map((m) => {
                  const other = otherDeptName(m.id)
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-cream">{m.name}</p>
                        <p className="truncate text-[11px] text-cream-dim">
                          {m.category} · {money(m.price)}
                          {other ? ` · ${t('departments.on')} ${other}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => assignItemToDepartment(m.id, department.id)}
                        title={t('departments.assign')}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gold/15 text-gold transition hover:bg-gold/25"
                      >
                        <IconPlus size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <button onClick={onClose} className="btn-gold mt-4 w-full">{t('departments.done')}</button>
        </div>
      </div>
    </div>
  )
}
