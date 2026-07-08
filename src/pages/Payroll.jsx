import { useMemo, useState } from 'react'
import { PageHeader, StatCard } from '../components/ui.jsx'
import { money } from '../utils/format.js'
import { monthAttendance, calcSalary } from '../utils/payroll.js'
import { STAFF } from '../data/mockData.js'
import {
  IconWallet,
  IconUsers,
  IconCalendar,
  IconCheck,
  IconClose,
} from '../components/Icons.jsx'

// ---------------------------------------------------------------------------
// Attendance calendar (read-only "Details" modal)
// ---------------------------------------------------------------------------
const DAY_STYLES = {
  present: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25',
  absent: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25',
  off: 'bg-white/[0.03] text-cream-dim/50',
  upcoming: 'border border-dashed border-ink-line text-cream-dim/40',
}

function DetailsModal({ staff, att, year, month, monthLabel, onClose }) {
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
              <span className="h-2.5 w-2.5 rounded bg-emerald-400" /> Present ({att.present})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-rose-400" /> Absent ({att.absent})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-white/20" /> Day off
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Salary edit modal (deductions)
// ---------------------------------------------------------------------------
function EditModal({ staff, att, calculated, deduction, onSave, onClose }) {
  const [ded, setDed] = useState(String(deduction || ''))
  const dedNum = Math.min(calculated, Math.max(0, Number(ded) || 0))
  const final = calculated - dedNum

  const Row = ({ label, value, strong }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-cream-dim">{label}</span>
      <span className={strong ? 'font-serif text-lg font-semibold text-gold' : 'text-sm font-semibold text-cream'}>
        {value}
      </span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">Edit Salary</h3>
              <p className="mt-0.5 text-xs text-cream-dim">
                {staff.name} · {staff.role}
              </p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-4 divide-y divide-ink-line">
            <Row label="Base salary (locked)" value={money(staff.baseSalary)} />
            <Row label="Present days" value={`${att.present} / ${att.workingDays}`} />
            <Row label="Absent days" value={att.absent} />
            <Row label="Calculated salary" value={money(calculated)} />
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
              Deductions (advances, fines, etc.)
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={calculated}
              className="input"
              placeholder="0"
              value={ded}
              onChange={(e) => setDed(e.target.value)}
            />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-gold/25 bg-gold/[0.06] px-4 py-3">
            <span className="text-sm text-cream-dim">Final salary</span>
            <span className="font-serif text-2xl font-semibold text-gold">{money(final)}</span>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              Cancel
            </button>
            <button
              onClick={() => {
                onSave(dedNum)
                onClose()
              }}
              className="btn-gold flex-1 py-3"
            >
              <IconCheck size={18} /> Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Staff payroll card
// ---------------------------------------------------------------------------
function PayrollCard({ staff, att, calculated, deduction, final, onDetails, onEdit }) {
  const pct = att.workingDays > 0 ? (att.present / att.workingDays) * 100 : 0
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-white/5 text-sm font-semibold text-cream ring-1 ring-ink-line">
          {staff.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-cream">{staff.name}</p>
          <p className="text-xs text-cream-dim">{staff.role}</p>
        </div>
        <span className="badge bg-gold/10 text-gold ring-1 ring-gold/20">{money(staff.baseSalary)}</span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-cream-dim">Attendance</span>
          <span className="font-semibold text-cream">
            {att.present}/{att.workingDays} days
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
          <span>Calculated</span>
          <span className="text-cream">{money(calculated)}</span>
        </div>
        {deduction > 0 && (
          <div className="flex justify-between text-cream-dim">
            <span>Deductions</span>
            <span className="text-rose-300">− {money(deduction)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="font-medium text-cream">Net salary</span>
          <span className="font-serif text-xl font-semibold text-gold">{money(final)}</span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={onDetails} className="btn-ghost flex-1 py-2 text-sm">
          <IconCalendar size={15} /> Details
        </button>
        <button
          onClick={onEdit}
          className="flex-1 rounded-xl border border-gold/40 bg-gold/10 py-2 text-sm font-semibold text-gold transition hover:bg-gold/20"
        >
          Edit
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Payroll page
// ---------------------------------------------------------------------------
export default function Payroll() {
  const today = useMemo(() => new Date(), [])
  const monthOptions = useMemo(() => {
    const opts = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      opts.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' }),
      })
    }
    return opts
  }, [today])

  const [monthKey, setMonthKey] = useState(monthOptions[0].key)
  const [deductions, setDeductions] = useState({}) // { [staffId]: amount }
  const [detailStaff, setDetailStaff] = useState(null)
  const [editStaff, setEditStaff] = useState(null)
  const [saved, setSaved] = useState(false)

  const [year, month] = monthKey.split('-').map(Number)
  const monthIndex = month - 1
  const monthLabel = monthOptions.find((m) => m.key === monthKey)?.label

  // Compute every staff member's payroll for the selected month.
  const rows = useMemo(
    () =>
      STAFF.map((staff) => {
        const att = monthAttendance(staff.id, year, monthIndex, today)
        const calculated = calcSalary(staff.baseSalary, att.workingDays, att.present)
        const deduction = deductions[staff.id] || 0
        const final = Math.max(0, calculated - deduction)
        return { staff, att, calculated, deduction, final }
      }),
    [year, monthIndex, today, deductions],
  )

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
      <PageHeader title="Payroll" subtitle="Monthly salaries based on attendance.">
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
        <StatCard icon={IconUsers} label="Staff on Payroll" value={STAFF.length} sub={monthLabel} />
        <StatCard icon={IconCalendar} label="Avg Attendance" value={`${avgAttendance}%`} sub="Present / working days" />
        <StatCard icon={IconWallet} label="Total Payroll" value={money(totalPayroll)} sub="Net, after deductions" />
      </div>

      {saved && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] px-5 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">
            <IconCheck size={16} />
          </span>
          <p className="text-sm text-cream">
            Payroll for <span className="font-semibold text-emerald-300">{monthLabel}</span> confirmed —
            total {money(totalPayroll)}.
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
            deduction={r.deduction}
            final={r.final}
            onDetails={() => setDetailStaff(r.staff.id)}
            onEdit={() => setEditStaff(r.staff.id)}
          />
        ))}
      </div>

      {/* Footer total + confirm */}
      <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-ink-line bg-ink-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-cream-dim">Total payroll · {monthLabel}</p>
          <p className="mt-1 font-serif text-3xl font-semibold text-gold">{money(totalPayroll)}</p>
        </div>
        <button onClick={() => setSaved(true)} className="btn-gold px-6 py-3">
          <IconCheck size={18} /> Save &amp; Confirm Payroll
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
          deduction={editRow.deduction}
          onSave={(amount) =>
            setDeductions((prev) => ({ ...prev, [editRow.staff.id]: amount }))
          }
          onClose={() => setEditStaff(null)}
        />
      )}
    </div>
  )
}
