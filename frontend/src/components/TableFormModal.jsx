import { useMemo, useState } from 'react'
import { useT } from '../i18n/LanguageContext.jsx'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { buildLabels } from '../utils/tableLabels.js'
import { BiLabel } from './ui.jsx'
import { IconClose, IconTable, IconPlus, IconCheck } from './Icons.jsx'

// Sentinel for the "+ New hall…" option, same pattern as Inventory.jsx /
// MenuManagement.jsx use for a new category.
const NEW_HALL = '__new__'
const SECTIONS = ['Indoor', 'Outdoor', 'Special']
const QUICK_COUNTS = [1, 5, 10, 20, 40]

// One form for both jobs, because they ask the same four questions: which hall,
// how many tables, how many seats, which section.
//
// Nothing here asks for a table id. Table.id is the database key (no
// autoincrement in schema.prisma), and making an operator invent "303" is what
// made adding a table hard enough to avoid — the server allocates it now.
export default function TableFormModal({ mode = 'add', hall = null, tables, onAdd, onUpdateHall, onClose }) {
  const t = useT()
  const editing = mode === 'edit'

  const halls = useMemo(() => {
    // Delivery/Takeaway are fixed order types, not a hall you can grow.
    const set = new Set(tables.filter((tbl) => !tbl.locked).map((tbl) => tbl.category || 'Other'))
    return [...set].sort()
  }, [tables])

  const members = useMemo(
    () => (hall ? tables.filter((tbl) => (tbl.category || 'Other') === hall) : []),
    [tables, hall],
  )

  const [category, setCategory] = useState(() => (editing ? hall : halls[0] || NEW_HALL))
  const [newHall, setNewHall] = useState('')
  const [count, setCount] = useState(() => (editing ? String(members.length) : '10'))
  const [seats, setSeats] = useState(() => String(members[0]?.seats || 4))
  const [section, setSection] = useState(() => members[0]?.section || 'Indoor')
  const [renumber, setRenumber] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [busy, setBusy] = useState(false)
  useEscapeKey(onClose)

  const resolvedCategory = category === NEW_HALL ? newHall.trim() : category
  const wanted = Number(count)
  // In edit mode the count is the hall's target size, so only the growth is new.
  const adding = editing ? Math.max(0, (Number.isFinite(wanted) ? wanted : 0) - members.length) : wanted

  // Live preview of the labels the server will generate. In edit mode the new
  // tables continue the hall we're renaming *into*, not the one we came from.
  const preview = useMemo(() => {
    if (!resolvedCategory || !Number.isInteger(adding) || adding < 1) return []
    const target = tables.filter((tbl) => (tbl.category || 'Other') === resolvedCategory)
    return buildLabels(resolvedCategory, target.length ? target : members, Math.min(adding, 100))
  }, [resolvedCategory, adding, tables, members])

  const touch = (fn) => (value) => {
    setError('')
    setDone('')
    fn(value)
  }

  const submit = async () => {
    setError('')
    setDone('')
    if (!resolvedCategory) return setError(t('tables.hallRequired'))
    if (!editing && (!Number.isInteger(wanted) || wanted < 1 || wanted > 100)) return setError(t('tables.countRange'))
    if (editing && Number.isFinite(wanted) && wanted < members.length) return setError(t('tables.cantReduce'))

    setBusy(true)
    const res = editing
      ? await onUpdateHall({
          category: hall,
          newName: resolvedCategory !== hall ? resolvedCategory : undefined,
          seats: Number(seats) || undefined,
          section,
          count: Number.isInteger(wanted) ? wanted : undefined,
          renumber,
        })
      : await onAdd({ category: resolvedCategory, count: wanted, seats: Number(seats) || undefined, section })
    setBusy(false)
    if (res?.error) return setError(res.error)

    if (editing) {
      setDone(t('tables.hallUpdated'))
      setRenumber(false)
      return
    }
    // Stay open so hall B can follow hall A without reopening the dialog.
    setDone(
      t('tables.addedOk')
        .replace('{count}', String(res?.created ?? wanted))
        .replace('{from}', res?.firstLabel ?? preview[0] ?? '')
        .replace('{to}', res?.lastLabel ?? preview[preview.length - 1] ?? ''),
    )
    setCount('10')
  }

  const label = 'mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
                <IconTable size={20} />
              </span>
              <div>
                <h3 className="font-serif text-xl text-cream">
                  {editing ? `${t('tables.editHall')} · ${hall}` : t('tables.addTables')}
                </h3>
                <p className="text-xs text-cream-dim">
                  {editing ? t('tables.editHallDesc') : t('tables.addTablesDesc')}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className={label}>{t('tables.hall')}</label>
              <select className="input" value={category} onChange={(e) => touch(setCategory)(e.target.value)}>
                {halls.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
                <option value={NEW_HALL}>{t('tables.newHall')}</option>
              </select>
              {category === NEW_HALL && (
                <input
                  autoFocus
                  className="input mt-2"
                  placeholder={t('tables.newHallPh')}
                  value={newHall}
                  onChange={(e) => touch(setNewHall)(e.target.value)}
                />
              )}
            </div>

            <div>
              <label className={label}>{editing ? t('tables.howManyTotal') : t('tables.howMany')}</label>
              <input
                type="number"
                min={editing ? members.length : 1}
                max={editing ? members.length + 100 : 100}
                className="input"
                value={count}
                onChange={(e) => touch(setCount)(e.target.value)}
              />
              {!editing && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {QUICK_COUNTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => touch(setCount)(String(n))}
                      className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                        Number(count) === n
                          ? 'border-gold/50 bg-gold/12 text-gold'
                          : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>{t('tables.seatsPerTable')}</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={seats}
                  onChange={(e) => touch(setSeats)(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>{t('tables.section')}</label>
                <select className="input" value={section} onChange={(e) => touch(setSection)(e.target.value)}>
                  {SECTIONS.map((s) => (
                    <option key={s} value={s}>
                      {t(`tables.section${s}`, s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* In edit mode the hall usually isn't growing, so the preview only
                appears once there is actually something to create. */}
            {(!editing || preview.length > 0) && (
              <div className="rounded-xl border border-gold/25 bg-gold/[0.05] px-4 py-3">
                <p className="text-[11px] uppercase tracking-wider text-cream-dim">{t('tables.preview')}</p>
                {preview.length === 0 ? (
                  <p className="mt-1 text-sm text-cream-dim">{t('tables.previewNone')}</p>
                ) : (
                  <p className="mt-1 font-serif text-lg text-gold">
                    {preview.length > 4
                      ? `${preview.slice(0, 3).join(', ')} … ${preview[preview.length - 1]}`
                      : preview.join(', ')}
                    <span className="ms-2 text-xs text-cream-dim">({preview.length})</span>
                  </p>
                )}
              </div>
            )}

            {editing && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-ink-line bg-ink-soft/50 px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-[#c9a227]"
                  checked={renumber}
                  onChange={(e) => touch(setRenumber)(e.target.checked)}
                />
                <span>
                  <span className="block text-sm text-cream">{t('tables.renumber')}</span>
                  <span className="block text-[11px] text-cream-dim">{t('tables.renumberHint')}</span>
                </span>
              </label>
            )}

            {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
            {done && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{done}</p>}
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-2.5 text-sm">
              {done ? t('tables.done') : t('common.cancel')}
            </button>
            <button onClick={submit} disabled={busy} className="btn-gold flex-1 py-2.5 text-sm disabled:opacity-60">
              {editing ? <IconCheck size={16} /> : <IconPlus size={16} />}{' '}
              {editing ? (
                <BiLabel ur="Hall save karein" en="Save hall" />
              ) : (
                <BiLabel ur="Tables banayein" en="Create tables" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
