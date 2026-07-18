import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { PageHeader, StatCard } from '../components/ui.jsx'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { money } from '../utils/format.js'
import {
  IconUsers,
  IconSearch,
  IconPlus,
  IconEdit,
  IconTrash,
  IconClose,
  IconCheck,
} from '../components/Icons.jsx'

// Job titles selectable when adding/editing a staff record. Includes
// 'Kitchen' so the Kitchen role (the one that actually gets recipe-creation
// access via permissions.js) can be assigned — it was missing before, which
// also broke editing the seeded Kitchen employee (no matching <option> for
// their existing role).
const ROLES = ['Manager', 'Cashier', 'Waiter', 'Chef', 'Kitchen']
const SHIFTS = ['Morning', 'Evening']

const ROLE_STYLE = {
  Manager: 'bg-sky-500/12 text-sky-300 ring-sky-500/30',
  Cashier: 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/30',
  Waiter: 'bg-gold/10 text-gold ring-gold/25',
  Chef: 'bg-purple-500/12 text-purple-300 ring-purple-500/30',
  Kitchen: 'bg-amber-500/12 text-amber-300 ring-amber-500/30',
}

// Defined at module scope (NOT inside EmployeeModal). If this lived inside the
// modal, every keystroke re-rendered the modal and produced a *new* Field
// function identity, so React unmounted/remounted each input and focus was lost
// after a single character.
function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">{label}</label>
      {children}
    </div>
  )
}

function EmployeeModal({ employee, onSave, onClose }) {
  const t = useT()
  const [form, setForm] = useState(
    employee || {
      name: '',
      role: 'Waiter',
      shift: 'Morning',
      phone: '',
      email: '',
      baseSalary: '',
      active: true,
    },
  )
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const valid = form.name.trim() && form.role
  useEscapeKey(onClose)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <h3 className="font-serif text-2xl text-cream">
              {employee ? t('employees.editEmployee') : t('employees.addEmployee')}
            </h3>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <Field label={`${t('employees.fullName')} *`}>
              <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('employees.namePh')} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`${t('employees.role')} *`}>
                <select className="input py-2.5" value={form.role} onChange={(e) => set('role', e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`roles.${r}`, r)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('employees.shift')}>
                <select className="input py-2.5" value={form.shift} onChange={(e) => set('shift', e.target.value)}>
                  {SHIFTS.map((s) => (
                    <option key={s} value={s}>
                      {t(`shifts.${s}`, s)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('employees.phone')}>
                <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder={t('employees.phonePh')} />
              </Field>
              <Field label={t('employees.baseSalary')}>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={form.baseSalary}
                  onChange={(e) => set('baseSalary', e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>

            <Field label={t('employees.email')}>
              <input className="input" value={form.email || ''} onChange={(e) => set('email', e.target.value)} placeholder={t('employees.emailPh')} />
            </Field>

            <label className="flex items-center gap-2.5 text-sm text-cream">
              <input
                type="checkbox"
                checked={form.active !== false}
                onChange={(e) => set('active', e.target.checked)}
                className="h-4 w-4 accent-gold"
              />
              {t('employees.activeCounts')}
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              {t('common.cancel')}
            </button>
            <button
              onClick={() => {
                onSave({
                  ...form,
                  name: form.name.trim(),
                  baseSalary: Number(form.baseSalary) || 0,
                })
                onClose()
              }}
              disabled={!valid}
              className="btn-gold flex-1 py-3 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconCheck size={18} /> {employee ? t('employees.saveChanges') : t('employees.addEmployee')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Employees() {
  const { staff, addStaff, updateStaff, deleteStaff, toggleStaff, user } = useApp()
  const t = useT()
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(undefined) // undefined=closed, null=add, obj=edit

  const canDelete = user?.role === 'Admin'

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? staff.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.role.toLowerCase().includes(q) ||
            (s.phone || '').toLowerCase().includes(q),
        )
      : staff
  }, [staff, query])

  const activeCount = staff.filter((s) => s.active !== false).length
  const waiterCount = staff.filter((s) => s.role === 'Waiter' && s.active !== false).length
  const chefCount = staff.filter((s) => s.role === 'Chef' && s.active !== false).length

  return (
    <div>
      <PageHeader title={t('employees.title')} subtitle={t('employees.subtitle')}>
        <button onClick={() => setModal(null)} className="btn-gold px-4 py-2 text-sm">
          <IconPlus size={16} /> {t('employees.addEmployee')}
        </button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard icon={IconUsers} label={t('employees.totalStaff')} value={staff.length} sub={t('employees.onRecord')} />
        <StatCard icon={IconCheck} label={t('employees.active')} value={activeCount} sub={t('employees.working')} />
        <StatCard icon={IconUsers} label={t('employees.waiters')} value={waiterCount} sub={t('employees.activeSub')} />
        <StatCard icon={IconUsers} label={t('employees.kitchen')} value={chefCount} sub={t('employees.chefs')} />
      </div>

      <div className="mb-5 relative sm:w-80">
        <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-cream-dim">
          <IconSearch size={18} />
        </span>
        <input
          className="input ps-11"
          placeholder={t('employees.searchPh')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-line text-xs uppercase tracking-wider text-cream-dim">
                <th className="px-5 py-3 font-semibold">{t('employees.colName')}</th>
                <th className="px-5 py-3 font-semibold">{t('employees.colRole')}</th>
                <th className="px-5 py-3 font-semibold">{t('employees.colShift')}</th>
                <th className="px-5 py-3 font-semibold">{t('employees.colPhone')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('employees.colBaseSalary')}</th>
                <th className="px-5 py-3 text-center font-semibold">{t('employees.colStatus')}</th>
                <th className="px-5 py-3 text-right font-semibold">{t('employees.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-line">
              {rows.map((s) => (
                <tr key={s.id} className={`transition hover:bg-white/[0.02] ${s.active === false ? 'opacity-60' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-xs font-semibold text-cream ring-1 ring-ink-line">
                        {s.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                      </div>
                      <div>
                        <p className="font-medium text-cream">{s.name}</p>
                        {s.email && <p className="text-xs text-cream-dim">{s.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`badge ring-1 ${ROLE_STYLE[s.role] || 'bg-white/5 text-cream-dim ring-ink-line'}`}>
                      {t(`roles.${s.role}`, s.role)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-cream-dim">{s.shift ? t(`shifts.${s.shift}`, s.shift) : '—'}</td>
                  <td className="px-5 py-3 text-cream-dim">{s.phone || '—'}</td>
                  <td className="px-5 py-3 text-right font-semibold text-cream">{money(s.baseSalary)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-center">
                      <button
                        onClick={() => toggleStaff(s.id)}
                        title={s.active !== false ? t('employees.activeClickDeactivate') : t('employees.inactiveClickActivate')}
                        className={`relative h-6 w-11 rounded-full transition ${
                          s.active !== false ? 'bg-emerald-500/70' : 'bg-ink-line'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-cream transition-all ${
                            s.active !== false ? 'left-[22px]' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setModal(s)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-cream-dim transition hover:border-gold/40 hover:text-gold"
                        title={t('common.edit')}
                      >
                        <IconEdit size={15} />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => deleteStaff(s.id)}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-cream-dim transition hover:border-rose-500/40 hover:text-rose-300"
                          title={t('common.delete')}
                        >
                          <IconTrash size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="p-10 text-center text-sm text-cream-dim">{t('employees.noMatch')}</div>
        )}
      </div>

      {modal !== undefined && (
        <EmployeeModal
          employee={modal}
          onSave={(data) => (modal ? updateStaff(modal.id, data) : addStaff(data))}
          onClose={() => setModal(undefined)}
        />
      )}
    </div>
  )
}
