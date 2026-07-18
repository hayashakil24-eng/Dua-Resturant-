import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useLang } from '../i18n/LanguageContext.jsx'
import { canModify } from '../config/permissions.js'
import { PageHeader, EmptyState } from '../components/ui.jsx'
import ItemAssignmentModal from '../components/ItemAssignmentModal.jsx'
import { IconDepartments, IconPlus, IconTrash, IconEdit, IconClose, IconUsers } from '../components/Icons.jsx'

const EMPTY_FORM = { name: '', nameUrdu: '', description: '', manager: '' }

export default function DepartmentManagement() {
  const { user, departments, addDepartment, deleteDepartment, menu, staff } = useApp()
  const { t, lang } = useLang()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [assignFor, setAssignFor] = useState(null) // department being edited
  const [confirmDelete, setConfirmDelete] = useState(null) // department id

  const isAdmin = user?.role === 'Admin'
  const managers = useMemo(() => staff.filter((s) => s.role === 'Manager' && s.active), [staff])

  // Route is permission-gated, but guard defensively too.
  if (!user || !canModify(user.role, 'departments')) {
    return (
      <div className="card p-8 text-center">
        <p className="text-lg font-semibold text-rose-400">{t('departments.denied')}</p>
      </div>
    )
  }

  const submit = async () => {
    const res = await addDepartment(form)
    if (res?.error) {
      setError(res.error)
      return
    }
    setForm(EMPTY_FORM)
    setError('')
    setShowForm(false)
  }

  const totalRouted = departments.reduce((s, d) => s + d.items.length, 0)

  return (
    <div>
      <PageHeader title={t('departments.title')} subtitle={t('departments.subtitle')}>
        <button onClick={() => { setShowForm((v) => !v); setError('') }} className="btn-gold">
          <IconPlus size={18} /> {t('departments.create')}
        </button>
      </PageHeader>

      {/* Create form */}
      {showForm && (
        <div className="card mb-6 border border-gold/30 bg-gold/[0.05] p-5">
          <h2 className="mb-4 font-serif text-xl text-cream">{t('departments.formTitle')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-cream-dim">{t('departments.name')}</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('departments.namePh')}
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-cream-dim">{t('departments.nameUrdu')}</label>
              <input
                value={form.nameUrdu}
                onChange={(e) => setForm({ ...form, nameUrdu: e.target.value })}
                placeholder={t('departments.nameUrduPh')}
                dir="rtl"
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-cream-dim">{t('departments.description')}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('departments.descriptionPh')}
                className="input h-16 resize-none"
              />
            </div>
            {isAdmin && (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-cream-dim">{t('departments.manager')}</label>
                <select
                  value={form.manager}
                  onChange={(e) => setForm({ ...form, manager: e.target.value })}
                  className="input"
                >
                  <option value="">{t('departments.unassigned')}</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
          <div className="mt-4 flex gap-3">
            <button onClick={() => { setShowForm(false); setError('') }} className="btn-ghost flex-1">
              {t('departments.cancel')}
            </button>
            <button onClick={submit} className="btn-gold flex-1">{t('departments.save')}</button>
          </div>
        </div>
      )}

      {/* Departments list */}
      <div className="grid gap-4 lg:grid-cols-2">
        {departments.map((dept) => (
          <div key={dept.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-serif text-xl text-cream">
                  {lang === 'ur' && dept.nameUrdu ? dept.nameUrdu : dept.name}
                </h3>
                {dept.description && <p className="mt-1 text-sm text-cream-dim">{dept.description}</p>}
                {dept.manager && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-gold">
                    <IconUsers size={12} className="shrink-0" /> {t('departments.managerLabel')}: {dept.manager}
                  </p>
                )}
              </div>
              {confirmDelete === dept.id ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => { deleteDepartment(dept.id); setConfirmDelete(null) }}
                    className="btn-danger px-2.5 py-1.5 text-xs"
                  >
                    {t('departments.deleteYes')}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-cream-dim hover:text-cream"
                  >
                    <IconClose size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(dept.id)}
                  title={t('departments.delete')}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-line text-cream-dim transition hover:border-rose-500/40 hover:text-rose-400"
                >
                  <IconTrash size={16} />
                </button>
              )}
            </div>

            {/* Assigned items */}
            <div className="mt-4 rounded-xl border border-ink-line bg-white/[0.02] p-3">
              <p className="mb-2 text-xs font-semibold text-cream-dim">
                {t('departments.itemsCount')}: <span className="text-cream">{dept.items.length}</span>
              </p>
              {dept.items.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {dept.items.slice(0, 12).map((id) => {
                    const item = menu.find((m) => m.id === id)
                    return (
                      <span key={id} className="rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold ring-1 ring-gold/20">
                        {item?.name || id}
                      </span>
                    )
                  })}
                  {dept.items.length > 12 && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-cream-dim">
                      +{dept.items.length - 12}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-cream-dim">{t('departments.noItems')}</p>
              )}
            </div>

            <button onClick={() => setAssignFor(dept)} className="btn-ghost mt-4 w-full">
              <IconEdit size={16} /> {t('departments.manageItems')}
            </button>
          </div>
        ))}
      </div>

      {departments.length === 0 && (
        <EmptyState icon={IconDepartments} title={t('departments.empty')} />
      )}

      <p className="mt-4 text-xs text-cream-dim">
        <span className="text-cream">{totalRouted}</span> {t('departments.routed')}
      </p>

      {assignFor && (
        <ItemAssignmentModal
          department={departments.find((d) => d.id === assignFor.id) || assignFor}
          onClose={() => setAssignFor(null)}
        />
      )}
    </div>
  )
}
