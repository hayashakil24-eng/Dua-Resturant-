import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useLang } from '../i18n/LanguageContext.jsx'
import { dateShort, time } from '../utils/format.js'
import { PageHeader, EmptyState } from '../components/ui.jsx'
import { IconCheck } from '../components/Icons.jsx'

const SYSTEM_ROLES = ['Admin', 'Manager', 'Cashier', 'Kitchen']

// Admin-only queue for self-signup requests (staffApproval pageKey) — same
// pending-card visual pattern as HandoverApprovals.jsx. No "processed" tab:
// a rejected signup just gets a plain login-screen error (confirmed scope),
// so there's no resolved-history list to show here.
export default function Approvals() {
  const { pendingSignups, approveSignup, rejectSignup } = useApp()
  const { t } = useLang()
  const [roleChoice, setRoleChoice] = useState({})
  const [busyId, setBusyId] = useState(null)

  const roleFor = (id) => roleChoice[id] || SYSTEM_ROLES[0]

  const handleApprove = async (id) => {
    setBusyId(id)
    await approveSignup(id, roleFor(id))
    setBusyId(null)
  }
  const handleReject = async (id) => {
    setBusyId(id)
    await rejectSignup(id)
    setBusyId(null)
  }

  return (
    <div>
      <PageHeader title={t('approvals.pageTitle')} subtitle={t('approvals.subtitle')} />

      <div className="space-y-3">
        {pendingSignups.length === 0 && <EmptyState icon={IconCheck} title={t('approvals.noPending')} />}
        {pendingSignups.map((s) => (
          <div
            key={s.id}
            className="card flex flex-wrap items-center justify-between gap-4 border border-amber-500/30 bg-amber-500/[0.05] p-5"
          >
            <div className="min-w-0">
              <p className="text-cream">
                <span className="font-semibold">{s.name}</span>{' '}
                <span className="text-cream-dim">@{s.username}</span>
              </p>
              <p className="mt-1 text-xs text-cream-dim">
                {t('approvals.requested')} {dateShort(s.createdAt)} · {time(s.createdAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <select
                className="input py-2.5"
                value={roleFor(s.id)}
                onChange={(e) => setRoleChoice((prev) => ({ ...prev, [s.id]: e.target.value }))}
              >
                {SYSTEM_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`, r)}
                  </option>
                ))}
              </select>
              <button disabled={busyId === s.id} onClick={() => handleApprove(s.id)} className="btn-gold disabled:opacity-60">
                {t('approvals.approve')}
              </button>
              <button
                disabled={busyId === s.id}
                onClick={() => handleReject(s.id)}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/15 disabled:opacity-60"
              >
                {t('approvals.reject')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
