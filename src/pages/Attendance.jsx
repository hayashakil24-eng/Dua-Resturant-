import { useApp } from '../context/AppContext.jsx'
import { PageHeader, StatusBadge, StatCard } from '../components/ui.jsx'
import { time, dateLong } from '../utils/format.js'
import { IconUsers, IconCheck, IconClock } from '../components/Icons.jsx'

export default function Attendance() {
  const { attendance, checkIn, checkOut, staff } = useApp()
  const roster = staff.filter((s) => s.active !== false)

  const counts = roster.reduce(
    (acc, s) => {
      const st = attendance[s.id]?.status || 'Absent'
      if (st === 'Present' || st === 'Late') acc.present += 1
      else if (st === 'Checked Out') acc.done += 1
      else acc.absent += 1
      return acc
    },
    { present: 0, done: 0, absent: 0 },
  )

  return (
    <div>
      <PageHeader title="Attendance" subtitle={dateLong()} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={IconUsers} label="On Duty" value={counts.present} sub="Present / late" />
        <StatCard icon={IconClock} label="Checked Out" value={counts.done} sub="Shift completed" />
        <StatCard icon={IconUsers} label="Absent" value={counts.absent} sub="Not checked in" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-line text-xs uppercase tracking-wider text-cream-dim">
                <th className="px-5 py-4 font-semibold">Staff</th>
                <th className="px-5 py-4 font-semibold">Role</th>
                <th className="px-5 py-4 font-semibold">Shift</th>
                <th className="px-5 py-4 font-semibold">Check-in</th>
                <th className="px-5 py-4 font-semibold">Check-out</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-line">
              {roster.map((s) => {
                const a = attendance[s.id] || { status: 'Absent' }
                const isIn = a.status === 'Present' || a.status === 'Late'
                const isOut = a.status === 'Checked Out'
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
                    <td className="px-5 py-4 text-cream">{time(a.checkIn)}</td>
                    <td className="px-5 py-4 text-cream">{time(a.checkOut)}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      {!isIn && !isOut && (
                        <button
                          onClick={() => checkIn(s.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                        >
                          <IconCheck size={14} /> Check In
                        </button>
                      )}
                      {isIn && (
                        <button
                          onClick={() => checkOut(s.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/20"
                        >
                          <IconClock size={14} /> Check Out
                        </button>
                      )}
                      {isOut && <span className="text-xs text-cream-dim">Done</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
