import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { PageHeader, StatCard } from '../components/ui.jsx'
import { money, dateShort } from '../utils/format.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import SettleReceivableModal from '../components/SettleReceivableModal.jsx'
import { IconWallet, IconAlert, IconCheck, IconPlus, IconClose } from '../components/Icons.jsx'

// Small inline modal to open a new credit account.
function AddAccountModal({ onClose, onSave }) {
  const t = useT()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('customer')
  const [error, setError] = useState('')
  useEscapeKey(onClose)

  const submit = async () => {
    const res = await onSave({ name: name.trim(), amount: Number(amount) || 0, type })
    if (res?.error) return setError(res.error)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <h3 className="font-serif text-2xl text-cream">{t('receivables.addTitle')}</h3>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>
          <div className="mt-5 space-y-3">
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('receivables.accountName')}
              </label>
              <input
                className="input"
                autoFocus
                placeholder={t('receivables.accountNamePh')}
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (error) setError('')
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  {t('receivables.openingBalance')}
                </label>
                <input type="number" inputMode="numeric" min={0} className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  {t('receivables.colType')}
                </label>
                <select className="input py-2" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="customer">{t('receivables.typeCustomer')}</option>
                  <option value="hotel">{t('receivables.typeHotel')}</option>
                  <option value="business">{t('receivables.typeBusiness')}</option>
                </select>
              </div>
            </div>
          </div>
          {error && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              {t('common.cancel')}
            </button>
            <button onClick={submit} className="btn-gold flex-1 py-3">
              <IconPlus size={18} /> {t('receivables.add')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ReceivablesManagement() {
  const { receivables, recordReceivablePayment, addReceivable } = useApp()
  const t = useT()
  const [showAll, setShowAll] = useState(false)
  const [settleTarget, setSettleTarget] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const rows = useMemo(
    () => (showAll ? receivables : receivables.filter((r) => r.status === 'open')),
    [receivables, showAll],
  )

  const openTotal = useMemo(
    () => receivables.filter((r) => r.status === 'open').reduce((s, r) => s + r.balance, 0),
    [receivables],
  )
  // Everything ever collected across accounts (settlement audit total).
  const collectedTotal = useMemo(
    () => receivables.reduce((s, r) => s + (r.payments || []).reduce((a, p) => a + p.amount, 0), 0),
    [receivables],
  )
  // Recent settlement/payment entries for the on-page audit list.
  const recentPayments = useMemo(
    () =>
      receivables
        .flatMap((r) => (r.payments || []).map((p) => ({ ...p, account: r.name })))
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, 8),
    [receivables],
  )

  const typeLabel = (ty) => t(`receivables.type${ty.charAt(0).toUpperCase()}${ty.slice(1)}`, ty)

  return (
    <div>
      <PageHeader title={t('receivables.title')} subtitle={t('receivables.subtitle')}>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-cream-dim">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="h-4 w-4 accent-gold"
            />
            {t('receivables.showAll')}
          </label>
          <button onClick={() => setShowAdd(true)} className="btn-gold px-4 py-2 text-sm">
            <IconPlus size={16} /> {t('receivables.newAccount')}
          </button>
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard icon={IconAlert} label={t('receivables.openReceivables')} value={money(openTotal)} sub={t('receivables.colBalance')} />
        <StatCard icon={IconCheck} label={t('receivables.settledTotal')} value={money(collectedTotal)} sub={t('receivables.title')} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-line text-xs uppercase tracking-wider text-cream-dim">
                <th className="px-5 py-4 font-semibold">{t('receivables.colAccount')}</th>
                <th className="px-5 py-4 font-semibold">{t('receivables.colType')}</th>
                <th className="px-5 py-4 text-right font-semibold">{t('receivables.colBalance')}</th>
                <th className="px-5 py-4 text-center font-semibold">{t('receivables.colStatus')}</th>
                <th className="px-5 py-4 text-right font-semibold">{t('receivables.colAction')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-line">
              {rows.map((r) => {
                const open = r.status === 'open'
                return (
                  <tr key={r.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <p className="font-medium text-cream">{r.name}</p>
                      {r.notes && <p className="text-xs text-cream-dim">{r.notes}</p>}
                    </td>
                    <td className="px-5 py-4 capitalize text-cream-dim">{typeLabel(r.type)}</td>
                    <td className={`px-5 py-4 text-right font-semibold ${open ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {money(r.balance)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`badge ring-1 ${
                          open
                            ? 'bg-rose-500/12 text-rose-300 ring-rose-500/30'
                            : 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/30'
                        }`}
                      >
                        {open ? t('receivables.statusOpen') : t('receivables.statusSettled')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {open && (
                        <button onClick={() => setSettleTarget(r)} className="btn-gold px-3 py-1.5 text-xs font-bold">
                          {t('receivables.markPaid')}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="p-10 text-center text-sm text-cream-dim">
            {showAll ? t('receivables.none') : t('receivables.noOpen')}
          </div>
        )}
      </div>

      {/* On-page settlement audit trail */}
      {recentPayments.length > 0 && (
        <div className="card mt-6 p-6">
          <div className="mb-4 flex items-center gap-2">
            <IconWallet size={18} className="text-gold" />
            <h2 className="font-serif text-xl text-cream">{t('receivables.settledTotal')}</h2>
          </div>
          <div className="space-y-2">
            {recentPayments.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-line bg-ink-soft/50 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium text-cream">{p.account}</span>
                  <span className="text-cream-dim"> · {p.method}</span>
                  {p.notes && <span className="text-cream-dim"> · {p.notes}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-emerald-300">{money(p.amount)}</span>
                  <span className="text-xs text-cream-dim">{p.by} · {dateShort(p.at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {settleTarget && (
        <SettleReceivableModal
          receivable={settleTarget}
          onClose={() => setSettleTarget(null)}
          onConfirm={({ amount, method, notes }) => {
            recordReceivablePayment(settleTarget.id, amount, { method, notes })
            setSettleTarget(null)
          }}
        />
      )}

      {showAdd && <AddAccountModal onClose={() => setShowAdd(false)} onSave={addReceivable} />}
    </div>
  )
}
