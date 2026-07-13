import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { PageHeader, StatCard } from '../components/ui.jsx'
import { money, dateShort, monthYear } from '../utils/format.js'
import { monthAttendance, calcSalary } from '../utils/payroll.js'
import {
  IconWallet,
  IconUsers,
  IconCalendar,
  IconCheck,
  IconClose,
  IconPlus,
  IconTrash,
} from '../components/Icons.jsx'

// ---------------------------------------------------------------------------
// Attendance calendar (read-only "Details" modal)
// ---------------------------------------------------------------------------
const DAY_STYLES = {
  present: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25',
  absent: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25',
  off: 'bg-white/[0.03] text-cream-dim',
  upcoming: 'border border-dashed border-ink-line text-cream-dim',
}

function DetailsModal({ staff, att, year, month, monthLabel, onClose }) {
  const t = useT()
  const firstDow = new Date(year, month, 1).getDay()
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: att.daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">{staff.name}</h3>
              <p className="mt-0.5 text-xs text-cream-dim">
                {staff.role} · {monthLabel}
              </p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-cream-dim">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-7 gap-1">
            {cells.map((day, i) =>
              day === null ? (
                <span key={`e${i}`} />
              ) : (
                <span
                  key={day}
                  className={`grid aspect-square place-items-center rounded-lg text-xs font-medium ${DAY_STYLES[att.statusByDay[day]]}`}
                >
                  {day}
                </span>
              ),
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-[11px] text-cream-dim">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-emerald-400" /> {t('payroll.present')} ({att.present})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-rose-400" /> {t('payroll.absent')} ({att.absent})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-white/20" /> {t('payroll.dayOff')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Salary & advances modal — multiple dated advances, deducted from salary
// ---------------------------------------------------------------------------
const ADV_STATUS = {
  pending: 'bg-amber-500/12 text-amber-300 ring-amber-500/30',
  recovered: 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/30',
}

// Module-scope so its identity is stable across the modal's re-renders (a
// nested definition would remount on every keystroke).
function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-cream-dim">{label}</span>
      <span className="text-sm font-semibold text-cream">{value}</span>
    </div>
  )
}

function EditModal({ staff, att, calculated, advances, onAddAdvance, onDeleteAdvance, onClose }) {
  const t = useT()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const advTotal = advances.reduce((s, a) => s + a.amount, 0)
  const final = Math.max(0, calculated - advTotal)
  const canAdd = Number(amount) > 0

  const submit = () => {
    if (!canAdd) return
    onAddAdvance({ amount: Number(amount), reason: reason.trim() })
    setAmount('')
    setReason('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">{t('payroll.salaryAdvances')}</h3>
              <p className="mt-0.5 text-xs text-cream-dim">
                {staff.name} · {t(`roles.${staff.role}`, staff.role)}
              </p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-4 divide-y divide-ink-line">
            <Row label={t('payroll.baseSalaryLocked')} value={money(staff.baseSalary)} />
            <Row label={t('payroll.presentDays')} value={`${att.present} / ${att.workingDays}`} />
            <Row label={t('payroll.calculatedSalary')} value={money(calculated)} />
          </div>

          {/* Advances this month */}
          <div className="mt-4">
            <label className="mb-2 block text-[11px] uppercase tracking-wider text-cream-dim">
              {t('payroll.advancesThisMonth')}
            </label>
            {advances.length === 0 ? (
              <p className="rounded-lg border border-ink-line bg-ink-soft/50 px-3 py-2 text-xs text-cream-dim">
                {t('payroll.noAdvances')}
              </p>
            ) : (
              <div className="space-y-2">
                {advances.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-ink-line bg-ink-soft/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-cream">
                        {money(a.amount)}{' '}
                        <span className="text-xs font-normal text-cream-dim">· {dateShort(a.date)}</span>
                      </p>
                      {a.reason && <p className="truncate text-xs text-cream-dim">{a.reason}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ring-1 ${ADV_STATUS[a.status] || ADV_STATUS.pending}`}>
                        {a.status === 'recovered' ? t('payroll.statusRecovered') : t('payroll.statusPending')}
                      </span>
                      {a.status === 'pending' && (
                        <button
                          onClick={() => onDeleteAdvance(a.id)}
                          className="text-cream-dim transition hover:text-rose-300"
                          title={t('payroll.removeAdvance')}
                        >
                          <IconTrash size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add advance */}
            <div className="mt-3 flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className="input py-2"
                placeholder={t('payroll.amountPh')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <input
                className="input py-2"
                placeholder={t('payroll.reasonPh')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button
                onClick={submit}
                disabled={!canAdd}
                className="btn-gold shrink-0 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconPlus size={16} /> {t('payroll.add')}
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-1 rounded-xl border border-gold/25 bg-gold/[0.06] px-4 py-3">
            <div className="flex items-center justify-between text-xs text-cream-dim">
              <span>{t('payroll.totalAdvances')}</span>
              <span className="text-rose-300">− {money(advTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-cream-dim">{t('payroll.finalSalary')}</span>
              <span className="font-serif text-2xl font-semibold text-gold">{money(final)}</span>
            </div>
          </div>

          <button onClick={onClose} className="btn-ghost mt-6 w-full py-3">
            <IconCheck size={18} /> {t('payroll.done')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Staff payroll card
// ---------------------------------------------------------------------------
function PayrollCard({ staff, att, calculated, advTotal, final, onDetails, onEdit }) {
  const t = useT()
  const pct = att.workingDays > 0 ? (att.present / att.workingDays) * 100 : 0
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-white/5 text-sm font-semibold text-cream ring-1 ring-ink-line">
          {staff.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-cream">{staff.name}</p>
          <p className="text-xs text-cream-dim">{t(`roles.${staff.role}`, staff.role)}</p>
        </div>
        <span className="badge bg-gold/10 text-gold ring-1 ring-gold/20">{money(staff.baseSalary)}</span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-cream-dim">{t('payroll.attendance')}</span>
          <span className="font-semibold text-cream">
            {att.present}/{att.workingDays} {t('payroll.days')}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-line">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-500"
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 space-y-1.5 border-t border-ink-line pt-4 text-sm">
        <div className="flex justify-between text-cream-dim">
          <span>{t('payroll.calculated')}</span>
          <span className="text-cream">{money(calculated)}</span>
        </div>
        {advTotal > 0 && (
          <div className="flex justify-between text-cream-dim">
            <span>{t('payroll.advances')}</span>
            <span className="text-rose-300">− {money(advTotal)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="font-medium text-cream">{t('payroll.netSalary')}</span>
          <span className="font-serif text-xl font-semibold text-gold">{money(final)}</span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={onDetails} className="btn-ghost flex-1 py-2 text-sm">
          <IconCalendar size={15} /> {t('payroll.details')}
        </button>
        <button
          onClick={onEdit}
          className="flex-1 rounded-xl border border-gold/40 bg-gold/10 py-2 text-sm font-semibold text-gold transition hover:bg-gold/20"
        >
          {t('payroll.edit')}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Payroll page
// ---------------------------------------------------------------------------
export default function Payroll() {
  const t = useT()
  const today = useMemo(() => new Date(), [])
  const monthOptions = useMemo(() => {
    const opts = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      opts.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: monthYear(d),
      })
    }
    return opts
  }, [today])

  const { advances, addAdvance, deleteAdvance, recoverAdvances, staff } = useApp()
  const [monthKey, setMonthKey] = useState(monthOptions[0].key)
  const [detailStaff, setDetailStaff] = useState(null)
  const [editStaff, setEditStaff] = useState(null)
  const [saved, setSaved] = useState(false)

  const [year, month] = monthKey.split('-').map(Number)
  const monthIndex = month - 1
  const monthLabel = monthOptions.find((m) => m.key === monthKey)?.label

  // Compute every staff member's payroll (incl. this month's advances).
  const rows = useMemo(
    () =>
      staff
        .filter((s) => s.active !== false)
        .map((emp) => {
          const att = monthAttendance(emp.id, year, monthIndex, today)
          const calculated = calcSalary(emp.baseSalary, att.workingDays, att.present)
          const staffAdvances = advances.filter((a) => {
            if (a.staffId !== emp.id) return false
            const d = new Date(a.date)
            return d.getFullYear() === year && d.getMonth() === monthIndex
          })
          const advTotal = staffAdvances.reduce((s, a) => s + a.amount, 0)
          const final = Math.max(0, calculated - advTotal)
          return { staff: emp, att, calculated, advances: staffAdvances, advTotal, final }
        }),
    [staff, year, monthIndex, today, advances],
  )

  // New advances land in the selected month (last day for past months).
  const advanceDate = () => {
    const isCurrent = year === today.getFullYear() && monthIndex === today.getMonth()
    return (isCurrent ? today : new Date(year, monthIndex + 1, 0)).toISOString()
  }

  const totalPayroll = rows.reduce((s, r) => s + r.final, 0)
  const avgAttendance = Math.round(
    rows.reduce((s, r) => s + (r.att.workingDays ? r.att.present / r.att.workingDays : 0), 0) /
      (rows.length || 1) *
      100,
  )

  const changeMonth = (key) => {
    setMonthKey(key)
    setSaved(false)
  }

  const editRow = editStaff ? rows.find((r) => r.staff.id === editStaff) : null
  const detailRow = detailStaff ? rows.find((r) => r.staff.id === detailStaff) : null

  return (
    <div>
      <PageHeader title={t('payroll.title')} subtitle={t('payroll.subtitle')}>
        <select
          className="input w-48 py-2"
          value={monthKey}
          onChange={(e) => changeMonth(e.target.value)}
        >
          {monthOptions.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={IconUsers} label={t('payroll.staffOnPayroll')} value={rows.length} sub={monthLabel} />
        <StatCard icon={IconCalendar} label={t('payroll.avgAttendance')} value={`${avgAttendance}%`} sub={t('payroll.presentOverWorking')} />
        <StatCard icon={IconWallet} label={t('payroll.totalPayroll')} value={money(totalPayroll)} sub={t('payroll.netAfterAdvances')} />
      </div>

      {saved && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] px-5 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">
            <IconCheck size={16} />
          </span>
          <p className="text-sm text-cream">
            {t('payroll.confirmedFor')} <span className="font-semibold text-emerald-300">{monthLabel}</span> {t('payroll.confirmedTotal')} {money(totalPayroll)}.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <PayrollCard
            key={r.staff.id}
            staff={r.staff}
            att={r.att}
            calculated={r.calculated}
            advTotal={r.advTotal}
            final={r.final}
            onDetails={() => setDetailStaff(r.staff.id)}
            onEdit={() => setEditStaff(r.staff.id)}
          />
        ))}
      </div>

      {/* Footer total + confirm */}
      <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-ink-line bg-ink-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-cream-dim">{t('payroll.totalPayrollLabel')} · {monthLabel}</p>
          <p className="mt-1 font-serif text-3xl font-semibold text-gold">{money(totalPayroll)}</p>
        </div>
        <button
          onClick={() => {
            recoverAdvances(year, monthIndex)
            setSaved(true)
          }}
          className="btn-gold px-6 py-3"
        >
          <IconCheck size={18} /> {t('payroll.saveConfirm')}
        </button>
      </div>

      {detailRow && (
        <DetailsModal
          staff={detailRow.staff}
          att={detailRow.att}
          year={year}
          month={monthIndex}
          monthLabel={monthLabel}
          onClose={() => setDetailStaff(null)}
        />
      )}

      {editRow && (
        <EditModal
          staff={editRow.staff}
          att={editRow.att}
          calculated={editRow.calculated}
          advances={editRow.advances}
          onAddAdvance={({ amount, reason }) =>
            addAdvance({ staffId: editRow.staff.id, amount, reason, date: advanceDate() })
          }
          onDeleteAdvance={deleteAdvance}
          onClose={() => setEditStaff(null)}
        />
      )}
    </div>
  )
}
