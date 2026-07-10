import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
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

const ROLES = ['Manager', 'Cashier', 'Waiter', 'Chef']
const SHIFTS = ['Morning', 'Evening']

const ROLE_STYLE = {
  Manager: 'bg-sky-500/12 text-sky-300 ring-sky-500/30',
  Cashier: 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/30',
  Waiter: 'bg-gold/10 text-gold ring-gold/25',
  Chef: 'bg-purple-500/12 text-purple-300 ring-purple-500/30',
}

function EmployeeModal({ employee, onSave, onClose }) {
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

  const Field = ({ label, children }) => (
    <div>
      <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">{label}</label>
      {children}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <h3 className="font-serif text-2xl text-cream">
              {employee ? 'Edit Employee' : 'Add Employee'}
            </h3>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Full name *">
              <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Ahmed Ali" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Role *">
                <select className="input py-2.5" value={form.role} onChange={(e) => set('role', e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Shift">
                <select className="input py-2.5" value={form.shift} onChange={(e) => set('shift', e.target.value)}>
                  {SHIFTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="0300-1234567" />
              </Field>
              <Field label="Base salary (Rs.)">
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

            <Field label="Email (optional)">
              <input className="input" value={form.email || ''} onChange={(e) => set('email', e.target.value)} placeholder="name@cafeali.com" />
            </Field>

            <label className="flex items-center gap-2.5 text-sm text-cream">
              <input
                type="checkbox"
                checked={form.active !== false}
                onChange={(e) => set('active', e.target.checked)}
                className="h-4 w-4 accent-gold"
              />
              Active (counts in payroll & attendance)
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              Cancel
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
              <IconCheck size={18} /> {employee ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Employees() {
  const { staff, addStaff, updateStaff, deleteStaff, toggleStaff, user } = useApp()
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
      <PageHeader title="Employees" subtitle="Add, edit and manage your staff.">
        <button onClick={() => setModal(null)} className="btn-gold px-4 py-2 text-sm">
          <IconPlus size={16} /> Add Employee
        </button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard icon={IconUsers} label="Total Staff" value={staff.length} sub="On record" />
        <StatCard icon={IconCheck} label="Active" value={activeCount} sub="Working" />
        <StatCard icon={IconUsers} label="Waiters" value={waiterCount} sub="Active" />
        <StatCard icon={IconUsers} label="Kitchen" value={chefCount} sub="Chefs" />
      </div>

      <div className="mb-5 relative sm:w-80">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cream-dim">
          <IconSearch size={18} />
        </span>
        <input
          className="input pl-11"
          placeholder="Search name, role or phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-line text-xs uppercase tracking-wider text-cream-dim">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Shift</th>
                <th className="px-5 py-3 font-semibold">Phone</th>
                <th className="px-5 py-3 text-right font-semibold">Base Salary</th>
                <th className="px-5 py-3 text-center font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
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
                      {s.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-cream-dim">{s.shift || '—'}</td>
                  <td className="px-5 py-3 text-cream-dim">{s.phone || '—'}</td>
                  <td className="px-5 py-3 text-right font-semibold text-cream">{money(s.baseSalary)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-center">
                      <button
                        onClick={() => toggleStaff(s.id)}
                        title={s.active !== false ? 'Active — click to deactivate' : 'Inactive — click to activate'}
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
                        title="Edit"
                      >
                        <IconEdit size={15} />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => deleteStaff(s.id)}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-cream-dim transition hover:border-rose-500/40 hover:text-rose-300"
                          title="Delete"
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
          <div className="p-10 text-center text-sm text-cream-dim">No employees match your search.</div>
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
