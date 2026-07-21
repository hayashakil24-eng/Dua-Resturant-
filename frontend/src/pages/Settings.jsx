import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { PageHeader } from '../components/ui.jsx'
import { canModify } from '../config/permissions.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { IconSettings, IconReceipt, IconWallet, IconPlus, IconClose, IconCheck, IconClock, IconRefresh, IconWhatsApp } from '../components/Icons.jsx'
import { apiGet } from '../api/client.js'

// Phase 3 "basic operational visibility" (docs/04-phase-3-deployment-
// hardening.md) — is the server up, when did it last back up. Admin-only,
// same gate as the rest of this page. Polls rather than using AppContext's
// FETCHERS/socket-refetch machinery: this is ops information about the
// server process itself, not app data any other page or role needs.
function ServerHealthPanel() {
  const t = useT()
  const [health, setHealth] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    apiGet('/api/system/health')
      .then((d) => {
        setHealth(d)
        setError('')
      })
      .catch(() => setError(t('settings.serverUnreachable', 'Cannot reach the local server.')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatUptime = (s) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div className="card max-w-2xl p-6">
      <div className="flex items-center justify-between gap-3 border-b border-ink-line pb-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
            <IconClock size={20} />
          </span>
          <div>
            <h3 className="font-serif text-xl text-cream">{t('settings.serverHealth', 'Server Health')}</h3>
            <p className="text-xs text-cream-dim">{t('settings.serverHealthDesc', 'Local server status.')}</p>
          </div>
        </div>
        <button
          onClick={load}
          title={t('common.refresh', 'Refresh')}
          className="grid h-9 w-9 place-items-center rounded-lg border border-ink-line text-cream-dim transition hover:text-cream"
        >
          <IconRefresh size={16} />
        </button>
      </div>

      <div className="mt-5 space-y-3 text-sm">
        {error ? (
          <p className="text-rose-300">{error}</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-cream-dim">{t('settings.serverStatus', 'Status')}</span>
              <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {loading ? t('common.loading', 'Checking…') : t('settings.online', 'Online')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-cream-dim">{t('settings.serverUptime', 'Up for')}</span>
              <span className="text-cream">{health ? formatUptime(health.uptimeSeconds) : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-cream-dim">{t('settings.lastBackup', 'Last backup')}</span>
              <span className="text-cream">
                {health?.lastBackupAt ? new Date(health.lastBackupAt).toLocaleString() : t('settings.noBackupYet', 'None yet')}
              </span>
            </div>
            {/* Phase 4 (docs/05-phase-4-vps-sync.md): only shown once VPS sync
                is actually configured — a plain local-only deployment has no
                VPS to report on, so hiding the row beats showing a permanent "—". */}
            {health?.vpsConfigured && (
              <div className="flex items-center justify-between">
                <span className="text-cream-dim">{t('settings.lastSync', 'Last VPS sync')}</span>
                <span className="text-cream">
                  {health.lastSyncAt ? new Date(health.lastSyncAt).toLocaleString() : t('settings.noSyncYet', 'None yet')}
                  {health.pendingSyncCount > 0 && (
                    <span className="ml-2 text-xs text-gold">
                      ({health.pendingSyncCount} {t('settings.pending', 'pending')})
                    </span>
                  )}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// A gold-themed on/off switch. Controlled — parent owns the value.
function Toggle({ checked, onChange, disabled, labelOn, labelOff }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-3 ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <span
        className={`relative h-7 w-12 rounded-full transition-colors ${
          checked ? 'bg-gold-grad' : 'bg-ink-line'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-cream shadow-md transition-all ${
            checked ? 'start-6' : 'start-1'
          }`}
        />
      </span>
      <span className={`text-sm font-semibold ${checked ? 'text-gold' : 'text-cream-dim'}`}>
        {checked ? labelOn : labelOff}
      </span>
    </button>
  )
}

const ACCOUNT_TYPES = ['JazzCash', 'Easypaisa', 'SadaPay', 'NayaPay', 'Bank Account', 'Other']

// Add / edit dialog for a single online payment account. `onSave` returns
// `{ error }` from the context (duplicate/empty name) which is shown inline.
function AccountFormModal({ account, onSave, onClose }) {
  const t = useT()
  const [name, setName] = useState(account?.name || '')
  const [type, setType] = useState(account?.type || ACCOUNT_TYPES[0])
  const [number, setNumber] = useState(account?.number || '')
  const [error, setError] = useState('')
  useEscapeKey(onClose)

  const save = async () => {
    const res = await onSave({ name: name.trim(), type, number: number.trim() })
    if (res?.error) return setError(res.error)
    onClose()
  }

  return (
    <div dir="ltr" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <h3 className="font-serif text-2xl text-cream">
              {account ? t('settings.editAccount', 'Edit Account') : t('settings.addAccount', 'Add Account')}
            </h3>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('settings.accountName', 'Account Name')} <span className="text-rose-300">*</span>
              </label>
              <input
                className="input"
                autoFocus
                placeholder="e.g. JazzCash - Main"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('settings.accountType', 'Account Type')}
              </label>
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                {ACCOUNT_TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {ty}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('settings.accountNumber', 'Account Number / ID')}
              </label>
              <input
                className="input"
                placeholder="e.g. 0300-1234567"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </div>
            {error && (
              <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              {t('common.cancel', 'Cancel')}
            </button>
            <button onClick={save} className="btn-gold flex-1 py-3">
              <IconCheck size={18} /> {t('common.save', 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const {
    gstEnabled,
    gstRate,
    setGst,
    setGstRate,
    whatsappReport,
    setWhatsappReportConfig,
    onlineAccounts,
    addOnlineAccount,
    updateOnlineAccount,
    toggleOnlineAccount,
    user,
  } = useApp()
  const t = useT()
  const canEdit = user && canModify(user.role, 'settings')
  const ratePct = Math.round(gstRate * 100)
  const fill = (s) => s.replace('{rate}', ratePct)
  const [formFor, setFormFor] = useState(null) // 'new' | account object | null

  // Editable GST rate (percent). Seeded from the saved rate; Save writes it back.
  const [rateInput, setRateInput] = useState(String(ratePct))
  const [rateError, setRateError] = useState('')
  const [rateSaved, setRateSaved] = useState(false)
  const saveRate = async () => {
    const res = await setGstRate(rateInput)
    if (res?.error) {
      setRateSaved(false)
      return setRateError(res.error)
    }
    setRateError('')
    setRateSaved(true)
    setTimeout(() => setRateSaved(false), 2000)
  }

  // WhatsApp daily report (requirements.md §6/§7) — hour + recipient are
  // edited as a draft and written back together on Save, same shape as the
  // GST rate field above; the enabled toggle writes immediately like GST's.
  const [waHourInput, setWaHourInput] = useState(String(whatsappReport.hour))
  const [waRecipientInput, setWaRecipientInput] = useState(whatsappReport.recipient)
  const [waError, setWaError] = useState('')
  const [waSaved, setWaSaved] = useState(false)
  useEffect(() => {
    setWaHourInput(String(whatsappReport.hour))
    setWaRecipientInput(whatsappReport.recipient)
  }, [whatsappReport.hour, whatsappReport.recipient])
  const saveWhatsappConfig = async () => {
    const res = await setWhatsappReportConfig({ hour: Number(waHourInput), recipient: waRecipientInput })
    if (res?.error) {
      setWaSaved(false)
      return setWaError(res.error)
    }
    setWaError('')
    setWaSaved(true)
    setTimeout(() => setWaSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      {/* Tax & GST */}
      <div className="card max-w-2xl p-6">
        <div className="flex items-center gap-3 border-b border-ink-line pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
            <IconReceipt size={20} />
          </span>
          <div>
            <h3 className="font-serif text-xl text-cream">{t('settings.taxSection')}</h3>
            <p className="text-xs text-cream-dim">{t('settings.gstLabel')}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md">
            <p className="text-sm font-semibold text-cream">
              {t('settings.gstLabel')} ({ratePct}%)
            </p>
            <p className="mt-1 text-xs leading-relaxed text-cream-dim">{fill(t('settings.gstDesc'))}</p>
          </div>
          <Toggle
            checked={gstEnabled}
            onChange={(v) => setGst(v)}
            disabled={!canEdit}
            labelOn={t('settings.gstOn')}
            labelOff={t('settings.gstOff')}
          />
        </div>

        {/* Editable rate — change 5% to 10% (or anything 0–100) whenever needed.
            Applies to every new bill immediately once GST is enabled. */}
        <div className="mt-5 border-t border-ink-line pt-5">
          <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
            {t('settings.gstRateLabel', 'GST Rate (%)')}
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.5"
              className="input w-32"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              disabled={!canEdit}
            />
            {canEdit && (
              <button onClick={saveRate} className="btn-gold px-5 py-2.5 text-sm">
                {t('common.save', 'Save')}
              </button>
            )}
            {rateError && <span className="text-xs text-rose-300">{rateError}</span>}
            {rateSaved && (
              <span className="text-xs text-emerald-300">
                {t('settings.rateSaved', 'Rate updated.')}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-cream-dim">
            {t('settings.gstRateHint', 'The percentage applied when GST is enabled. Takes effect on new bills right away.')}
          </p>
        </div>

        <div
          className={`mt-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-medium ${
            gstEnabled
              ? 'border-gold/25 bg-gold/[0.06] text-gold'
              : 'border-ink-line bg-ink-soft/50 text-cream-dim'
          }`}
        >
          <IconSettings size={14} />
          {gstEnabled ? fill(t('settings.gstStatusOn')) : t('settings.gstStatusOff')}
        </div>
      </div>

      {/* WhatsApp daily report */}
      <div className="card max-w-2xl p-6">
        <div className="flex items-center gap-3 border-b border-ink-line pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
            <IconWhatsApp size={20} />
          </span>
          <div>
            <h3 className="font-serif text-xl text-cream">
              {t('settings.whatsappSection', 'WhatsApp Daily Report')}
            </h3>
            <p className="text-xs text-cream-dim">
              {t('settings.whatsappDesc', 'Send the latest closing report automatically, once a day.')}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md">
            <p className="text-sm font-semibold text-cream">
              {t('settings.whatsappEnableLabel', 'Automated daily send')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-cream-dim">
              {t(
                'settings.whatsappEnableDesc',
                'Sends the most recently closed day’s report at the hour below. Nothing sends until a day has actually been closed.',
              )}
            </p>
          </div>
          <Toggle
            checked={whatsappReport.enabled}
            onChange={(v) => setWhatsappReportConfig({ enabled: v })}
            disabled={!canEdit}
            labelOn={t('settings.whatsappOn', 'On')}
            labelOff={t('settings.whatsappOff', 'Off')}
          />
        </div>

        <div className="mt-5 grid gap-4 border-t border-ink-line pt-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
              {t('settings.whatsappHourLabel', 'Send hour (24h, local time)')}
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={23}
              step="1"
              className="input w-32"
              value={waHourInput}
              onChange={(e) => setWaHourInput(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
              {t('settings.whatsappRecipientLabel', 'Admin WhatsApp number')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="923001234567"
              className="input w-full"
              value={waRecipientInput}
              onChange={(e) => setWaRecipientInput(e.target.value)}
              disabled={!canEdit}
            />
          </div>
        </div>

        {canEdit && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={saveWhatsappConfig} className="btn-gold px-5 py-2.5 text-sm">
              {t('common.save', 'Save')}
            </button>
            {waError && <span className="text-xs text-rose-300">{waError}</span>}
            {waSaved && <span className="text-xs text-emerald-300">{t('settings.whatsappSaved', 'Saved.')}</span>}
          </div>
        )}

        <p className="mt-3 text-xs text-cream-dim">
          {t(
            'settings.whatsappHint',
            'Digits only, country code first, no leading + (e.g. 923001234567). The admin can also request the latest report any time by messaging the system directly on WhatsApp.',
          )}
        </p>
      </div>

      {/* Online payment accounts */}
      <div className="card max-w-2xl p-6">
        <div className="flex items-center justify-between gap-3 border-b border-ink-line pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
              <IconWallet size={20} />
            </span>
            <div>
              <h3 className="font-serif text-xl text-cream">
                {t('settings.onlineAccounts', 'Online Payment Accounts')}
              </h3>
              <p className="text-xs text-cream-dim">
                {t('settings.onlineAccountsDesc', 'Destinations a cashier can attribute an Online payment to (JazzCash, Easypaisa, bank…).')}
              </p>
            </div>
          </div>
          {canEdit && (
            <button onClick={() => setFormFor('new')} className="btn-gold shrink-0 px-4 py-2 text-sm">
              <IconPlus size={16} /> {t('settings.addAccount', 'Add Account')}
            </button>
          )}
        </div>

        {onlineAccounts.length === 0 ? (
          <p className="mt-5 rounded-xl border border-ink-line bg-ink-soft/50 px-4 py-6 text-center text-sm text-cream-dim">
            {t('settings.noAccounts', 'No online accounts yet. Add one so cashiers can record online payments.')}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-line">
            {onlineAccounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-cream">
                    {a.name}
                    <span
                      className={`badge ring-1 ${
                        a.active
                          ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25'
                          : 'bg-ink-soft text-cream-dim ring-ink-line'
                      }`}
                    >
                      {a.active ? t('settings.active', 'Active') : t('settings.inactive', 'Inactive')}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-cream-dim">
                    {a.type}
                    {a.number ? ` · ${a.number}` : ''}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleOnlineAccount(a.id)}
                      className="rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 text-xs font-semibold text-cream-dim transition hover:text-cream"
                    >
                      {a.active ? t('settings.deactivate', 'Deactivate') : t('settings.activate', 'Activate')}
                    </button>
                    <button
                      onClick={() => setFormFor(a)}
                      className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20"
                    >
                      {t('common.edit', 'Edit')}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit && <ServerHealthPanel />}

      {formFor && (
        <AccountFormModal
          account={formFor === 'new' ? null : formFor}
          onSave={(fields) =>
            formFor === 'new' ? addOnlineAccount(fields) : updateOnlineAccount(formFor.id, fields)
          }
          onClose={() => setFormFor(null)}
        />
      )}
    </div>
  )
}
