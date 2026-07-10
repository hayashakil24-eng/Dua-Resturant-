import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, StatusBadge, StatCard } from '../components/ui.jsx'
import { canModify } from '../config/permissions.js'
import ManualOverrideModal from '../components/ManualOverrideModal.jsx'
import { time, dateLong } from '../utils/format.js'
import { resolveAttendanceStatus, formatLateDuration } from '../utils/attendanceHelpers.js'
import { IconUsers, IconClock, IconEdit, IconReport, IconAlert } from '../components/Icons.jsx'

// Machine (biometric) verified vs. an Admin manual override.
function SourceBadge({ record }) {
  if (record.source === 'manual') {
    return (
      <span className="badge bg-amber-500/12 text-amber-300 ring-1 ring-amber-500/30">
        Manual Entry
      </span>
    )
  }
  if (record.checkIn) {
    return (
      <span className="badge bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/30">
        Machine Verified
      </span>
    )
  }
  return <span className="text-xs text-cream-dim">—</span>
}

export default function Attendance() {
  const { attendance, overrideAttendance, staff, user } = useApp()
  const roster = staff.filter((s) => s.active !== false)

  // Emergency manual override is Admin-only (Manager/Cashier cannot).
  const canOverride = user && canModify(user.role, 'attendanceOverride')
  const [editing, setEditing] = useState(null) // staff row being overridden

  // Status is derived live from check-in vs. shift start, so a late arrival is
  // flagged even when the stored record just says "Present".
  const counts = roster.reduce(
    (acc, s) => {
      const { status } = resolveAttendanceStatus(attendance[s.id], s.shiftStartTime)
      if (status === 'Present' || status === 'Late') acc.present += 1
      if (status === 'Late') acc.late += 1 // Late still counts as on duty, just flagged
      else if (status === 'Checked Out') acc.done += 1
      else if (status === 'Absent') acc.absent += 1
      return acc
    },
    { present: 0, late: 0, done: 0, absent: 0 },
  )

  // Manual-override records, newest first — drives the Admin audit section.
  const manualEntries = roster
    .map((s) => ({ staff: s, record: attendance[s.id] }))
    .filter(({ record }) => record?.source === 'manual' && record.manualEntry)
    .sort(
      (a, b) =>
        new Date(b.record.manualEntry.enteredAt) - new Date(a.record.manualEntry.enteredAt),
    )

  return (
    <div>
      <PageHeader title="Attendance" subtitle={dateLong()} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={IconUsers} label="On Duty" value={counts.present} sub="Present / late" />
        <StatCard icon={IconAlert} label="Late Today" value={counts.late} sub="After grace period" />
        <StatCard icon={IconClock} label="Checked Out" value={counts.done} sub="Shift completed" />
        <StatCard icon={IconUsers} label="Absent" value={counts.absent} sub="Not checked in" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-line text-xs uppercase tracking-wider text-cream-dim">
                <th className="px-5 py-4 font-semibold">Staff</th>
                <th className="px-5 py-4 font-semibold">Role</th>
                <th className="px-5 py-4 font-semibold">Shift</th>
                <th className="px-5 py-4 font-semibold">Check-in</th>
                <th className="px-5 py-4 font-semibold">Check-out</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold">Source</th>
                {canOverride && <th className="px-5 py-4 text-right font-semibold">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-line">
              {roster.map((s) => {
                const a = attendance[s.id] || { status: 'Absent' }
                // Live status: check-in vs. shift start (+ grace period) → Late.
                const { status, lateByMinutes } = resolveAttendanceStatus(a, s.shiftStartTime)
                return (
                  <tr key={s.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-xs font-semibold text-cream ring-1 ring-ink-line">
                          {s.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <p className="font-medium text-cream">{s.name}</p>
                          <p className="text-xs text-cream-dim">{s.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-cream-dim">{s.role}</td>
                    <td className="px-5 py-4 text-cream-dim">{s.shift}</td>
                    {/* Check-in / out are machine data — read-only, no inputs */}
                    <td className="px-5 py-4 text-cream">{time(a.checkIn)}</td>
                    <td className="px-5 py-4 text-cream">{time(a.checkOut)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={status} />
                        {status === 'Late' && (
                          <span className="text-xs font-medium text-amber-300">
                            {formatLateDuration(lateByMinutes)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <SourceBadge record={a} />
                    </td>
                    {canOverride && (
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setEditing(s)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line bg-white/5 px-3 py-1.5 text-xs font-semibold text-cream-dim transition hover:bg-white/10 hover:text-cream"
                        >
                          <IconEdit size={14} /> Override
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual override audit trail — Admin only */}
      {canOverride && manualEntries.length > 0 && (
        <div className="card mt-6 p-6">
          <div className="mb-4 flex items-center gap-2">
            <IconReport size={18} className="text-gold" />
            <h2 className="font-serif text-xl text-cream">Manual Override History</h2>
          </div>
          <div className="space-y-3">
            {manualEntries.map(({ staff: s, record }) => (
              <div
                key={s.id}
                className="flex flex-col gap-2 rounded-2xl border-l-2 border-amber-500/50 bg-ink-soft p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="font-medium text-cream">{s.name}</p>
                  <p className="mt-0.5 text-sm text-cream-dim">
                    Reason: {record.manualEntry.reason}
                  </p>
                  {record.manualEntry.notes && (
                    <p className="mt-1 text-xs text-cream-dim">Notes: {record.manualEntry.notes}</p>
                  )}
                  <p className="mt-1 text-xs text-cream-dim">
                    In {time(record.checkIn)} · Out {time(record.checkOut)}
                  </p>
                </div>
                <div className="text-xs text-cream-dim sm:text-right">
                  <p>By: {record.manualEntry.enteredBy}</p>
                  <p>{time(record.manualEntry.enteredAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {canOverride && editing && (
        <ManualOverrideModal
          staff={editing}
          record={attendance[editing.id] || {}}
          onClose={() => setEditing(null)}
          onSave={(data) => {
            overrideAttendance(editing.id, data)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
