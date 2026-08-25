import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { PageHeader, PasswordInput } from '../components/ui.jsx'
import { canModify } from '../config/permissions.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { IconSettings, IconReceipt, IconWallet, IconPlus, IconClose, IconCheck, IconClock, IconRefresh, IconWhatsApp, IconLock, IconAttendance, IconPrint } from '../components/Icons.jsx'
import { apiGet, apiPost } from '../api/client.js'
import { WALLET_TYPES, PK_BANKS, BANK_OTHER, ERR_WALLET, ERR_BANK, accountFieldsFor, sanitizeAccountNumber, sanitizeIban, validateAccount } from '../utils/accountNumber.js'

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
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [syncErr, setSyncErr] = useState('')
  const [backingUp, setBackingUp] = useState(false)
  const [backupMsg, setBackupMsg] = useState('')
  const [backupErr, setBackupErr] = useState('')
  const [attSyncing, setAttSyncing] = useState(false)
  const [attSyncMsg, setAttSyncMsg] = useState('')
  const [attSyncErr, setAttSyncErr] = useState('')

  // App auto-update — Priority-2 fix from the update-reliability investigation.
  // Electron-only (no window.electron in the NO_ELECTRON=1 browser dev loop);
  // 'idle' | 'checking' | 'available' | 'not-available' | 'error'. Listens to
  // the same main.js events electron/preload.js exposes for this button
  // specifically (see preload.js) — the ordinary silent scheduled checks
  // don't drive this UI unless this panel happens to be open when one fires,
  // which is fine for an admin diagnostics panel.
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState('idle')
  const [updateMessage, setUpdateMessage] = useState('')
  useEffect(() => {
    if (!window.electron) return
    window.electron.getAppVersion?.().then(setAppVersion)
    window.electron.onUpdateChecking?.(() => {
      setUpdateStatus('checking')
      setUpdateMessage('')
    })
    window.electron.onUpdateAvailable?.(({ version }) => {
      setUpdateStatus('available')
      setUpdateMessage(version)
    })
    window.electron.onUpdateNotAvailable?.(() => setUpdateStatus('not-available'))
    window.electron.onUpdateError?.(({ message }) => {
      setUpdateStatus('error')
      setUpdateMessage(message)
    })
  }, [])
  const checkForUpdatesNow = async () => {
    setUpdateStatus('checking')
    setUpdateMessage('')
    const res = await window.electron.checkForUpdatesNow()
    if (!res.ok) {
      setUpdateStatus('error')
      setUpdateMessage(res.message)
    }
    // On success, the terminal state (available / not-available / error)
    // arrives via the event listeners above, dispatched by electron-updater.
  }

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

  // Manual push — the background job already retries on its own interval, so
  // this is just "don't make me wait for the next tick" after e.g. fixing the
  // internet connection or the VPS coming back up.
  const syncNow = async () => {
    setSyncing(true)
    setSyncMsg('')
    setSyncErr('')
    try {
      const res = await apiPost('/api/system/sync-now')
      setSyncMsg(
        t('settings.syncResult', '{pushed} sent, {failed} failed.')
          .replace('{pushed}', res.pushed)
          .replace('{failed}', res.failed),
      )
      load()
    } catch (err) {
      setSyncErr(err.message)
    } finally {
      setSyncing(false)
    }
  }

  // Manual backup — the scheduled job already writes one once a day, so this
  // is for grabbing a fresh copy on demand (e.g. right before a risky change)
  // instead of waiting for env.backupHour to roll around.
  const backupNow = async () => {
    setBackingUp(true)
    setBackupMsg('')
    setBackupErr('')
    try {
      const res = await apiPost('/api/system/backup-now')
      setBackupMsg(
        t('settings.backupResult', 'Saved at {time}.').replace(
          '{time}',
          new Date(res.at).toLocaleTimeString(),
        ),
      )
      load()
    } catch (err) {
      setBackupErr(err.message)
    } finally {
      setBackingUp(false)
    }
  }

  // Manual attendance-machine sync — the background poller already retries
  // on its own interval, so this is for an Admin who wants a just-happened
  // punch to show up right away instead of waiting out the interval.
  const attSyncNow = async () => {
    setAttSyncing(true)
    setAttSyncMsg('')
    setAttSyncErr('')
    try {
      const res = await apiPost('/api/system/attendance-sync-now')
      setAttSyncMsg(
        t('settings.attendanceSyncResult', '{records} record(s) updated.').replace('{records}', res.recordsUpdated),
      )
      load()
    } catch (err) {
      setAttSyncErr(err.message)
    } finally {
      setAttSyncing(false)
    }
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
            <div className="flex items-center gap-3 border-t border-ink-line pt-3">
              <button
                onClick={backupNow}
                disabled={backingUp}
                className="btn-ghost px-4 py-2 text-xs disabled:opacity-60"
              >
                <IconRefresh size={14} className={backingUp ? 'animate-spin' : ''} />
                {backingUp ? t('settings.backingUp', 'Backing up…') : t('settings.backupNow', 'Backup Now')}
              </button>
              {backupMsg && <span className="text-xs text-emerald-300">{backupMsg}</span>}
              {backupErr && <span className="text-xs text-rose-300">{backupErr}</span>}
            </div>
            {/* Phase 4 (docs/05-phase-4-vps-sync.md): only shown once VPS sync
                is actually configured — a plain local-only deployment has no
                VPS to report on, so hiding the row beats showing a permanent "—". */}
            {health?.vpsConfigured && (
              <>
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
                <div className="flex items-center gap-3 border-t border-ink-line pt-3">
                  <button
                    onClick={syncNow}
                    disabled={syncing}
                    className="btn-ghost px-4 py-2 text-xs disabled:opacity-60"
                  >
                    <IconRefresh size={14} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? t('settings.syncing', 'Syncing…') : t('settings.syncNow', 'Sync Now')}
                  </button>
                  {syncMsg && <span className="text-xs text-emerald-300">{syncMsg}</span>}
                  {syncErr && <span className="text-xs text-rose-300">{syncErr}</span>}
                </div>
              </>
            )}
            {/* Same "only when configured" reasoning as the VPS block above —
                no attendance machine on-site yet means nothing to report. */}
            {health?.attendanceDeviceConfigured && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-cream-dim">{t('settings.lastAttendanceSync', 'Last attendance sync')}</span>
                  <span className="text-cream">
                    {health.lastAttendanceSyncAt
                      ? new Date(health.lastAttendanceSyncAt).toLocaleString()
                      : t('settings.noSyncYet', 'None yet')}
                  </span>
                </div>
                <div className="flex items-center gap-3 border-t border-ink-line pt-3">
                  <button
                    onClick={attSyncNow}
                    disabled={attSyncing}
                    className="btn-ghost px-4 py-2 text-xs disabled:opacity-60"
                  >
                    <IconRefresh size={14} className={attSyncing ? 'animate-spin' : ''} />
                    {attSyncing ? t('settings.syncing', 'Syncing…') : t('settings.attendanceSyncNow', 'Sync Attendance Now')}
                  </button>
                  {attSyncMsg && <span className="text-xs text-emerald-300">{attSyncMsg}</span>}
                  {attSyncErr && <span className="text-xs text-rose-300">{attSyncErr}</span>}
                </div>
              </>
            )}
          </>
        )}
        {window.electron && (
          <div className="border-t border-ink-line pt-3">
            <div className="flex items-center justify-between">
              <span className="text-cream-dim">{t('settings.appVersion', 'App version')}</span>
              <span className="text-cream">{appVersion || '—'}</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={checkForUpdatesNow}
                disabled={updateStatus === 'checking'}
                className="btn-ghost px-4 py-2 text-xs disabled:opacity-60"
              >
                <IconRefresh size={14} className={updateStatus === 'checking' ? 'animate-spin' : ''} />
                {updateStatus === 'checking'
                  ? t('settings.checkingForUpdates', 'Checking…')
                  : t('settings.checkForUpdates', 'Check for Updates Now')}
              </button>
              {updateStatus === 'not-available' && (
                <span className="text-xs text-emerald-300">{t('settings.upToDate', "You're on the latest version.")}</span>
              )}
              {updateStatus === 'available' && (
                <span className="text-xs text-gold">
                  {t('settings.updateFoundDownloading', 'Update v{version} found — downloading…').replace('{version}', updateMessage)}
                </span>
              )}
              {updateStatus === 'error' && <span className="text-xs text-rose-300">{updateMessage}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Which physical printer silent Electron printing (src/utils/print.js's
// safePrint) targets. Enumeration is read-only, via electron/main.js's
// list-printers IPC handler — the renderer never touches webContents
// directly. The choice itself is a client-side preference, stored the same
// way LanguageContext.jsx already stores `lang`: a plain localStorage key
// print.js reads synchronously, not app/domain data through AppContext.
// Electron-only (window.electron.listPrinters) — in a browser dev session
// (NO_ELECTRON=1) there's no IPC to enumerate against, so the panel says so
// instead of showing an empty picker.
const PRINTER_STORAGE_KEY = 'receiptPrinter'
const PRINTER_TYPE_STORAGE_KEY = 'receiptPrinterType'

function PrinterSettingsPanel() {
  const t = useT()
  const isElectron = typeof window !== 'undefined' && Boolean(window.electron?.listPrinters)
  const [printers, setPrinters] = useState([])
  const [selected, setSelected] = useState(() => (typeof window !== 'undefined' && localStorage.getItem(PRINTER_STORAGE_KEY)) || '')
  // 'thermal' (default) sends raw ESC/POS bytes — for the real receipt
  // printer (e.g. BC-98AC). 'normal' routes through the same HTML/CSS print
  // path Reports use — for a regular GDI printer (inkjet/laser) that
  // doesn't understand ESC/POS control bytes and would otherwise just keep
  // ejecting garbled pages instead of stopping at one receipt.
  const [printerType, setPrinterType] = useState(
    () => (typeof window !== 'undefined' && localStorage.getItem(PRINTER_TYPE_STORAGE_KEY)) || 'thermal'
  )
  const [loading, setLoading] = useState(isElectron)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const load = () => {
    if (!isElectron) return
    setLoading(true)
    setError('')
    window.electron
      .listPrinters()
      .then((list) => setPrinters(list || []))
      .catch((err) => setError(err?.message || t('settings.printerListFailed', 'Could not list printers.')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choose = (name) => {
    setSelected(name)
    if (name) localStorage.setItem(PRINTER_STORAGE_KEY, name)
    else localStorage.removeItem(PRINTER_STORAGE_KEY)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const chooseType = (type) => {
    setPrinterType(type)
    localStorage.setItem(PRINTER_TYPE_STORAGE_KEY, type)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="card max-w-2xl p-6">
      <div className="flex items-center justify-between gap-3 border-b border-ink-line pb-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
            <IconPrint size={20} />
          </span>
          <div>
            <h3 className="font-serif text-xl text-cream">{t('settings.printerSection', 'Receipt Printer')}</h3>
            <p className="text-xs text-cream-dim">
              {t('settings.printerDesc', 'Bills print directly to this printer — no dialog, no preview.')}
            </p>
          </div>
        </div>
        {isElectron && (
          <button
            onClick={load}
            title={t('common.refresh', 'Refresh')}
            className="grid h-9 w-9 place-items-center rounded-lg border border-ink-line text-cream-dim transition hover:text-cream"
          >
            <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      <div className="mt-5 space-y-3 text-sm">
        {!isElectron ? (
          <p className="text-cream-dim">
            {t('settings.printerElectronOnly', 'Printer selection is only available in the desktop app.')}
          </p>
        ) : error ? (
          <p className="text-rose-300">{error}</p>
        ) : loading ? (
          <p className="text-cream-dim">{t('common.loading', 'Loading…')}</p>
        ) : (
          <>
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('settings.printerLabel', 'Printer')}
              </label>
              <select className="input py-2.5" value={selected} onChange={(e) => choose(e.target.value)}>
                <option value="">{t('settings.printerSystemDefault', 'System default')}</option>
                {printers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.displayName || p.name}
                  </option>
                ))}
              </select>
              {printers.length === 0 && (
                <p className="mt-1.5 text-xs text-cream-dim">
                  {t('settings.printerNone', 'No printers detected — check Windows printer settings.')}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('settings.printerTypeLabel', 'Printer Type')}
              </label>
              <select className="input py-2.5" value={printerType} onChange={(e) => chooseType(e.target.value)}>
                <option value="thermal">{t('settings.printerTypeThermal', 'Thermal (receipt printer)')}</option>
                <option value="normal">{t('settings.printerTypeNormal', 'Normal (regular printer)')}</option>
              </select>
              <p className="mt-1.5 text-xs text-cream-dim">
                {printerType === 'thermal'
                  ? t(
                      'settings.printerTypeThermalDesc',
                      'For a real thermal receipt printer (e.g. BC-98AC). Wrong choice here will make a regular printer eject blank/garbled pages non-stop.'
                    )
                  : t(
                      'settings.printerTypeNormalDesc',
                      'For a regular printer (inkjet/laser, e.g. Epson) — prints the bill as a normal page instead of raw receipt data.'
                    )}
              </p>
            </div>
            {saved && <p className="text-xs text-emerald-300">{t('settings.printerSaved', 'Saved.')}</p>}
          </>
        )}
      </div>
    </div>
  )
}

// Left-panel nav item — a horizontal scrollable pill row on narrow screens,
// a vertical full-width list from lg: up (same collapse pattern as the app's
// own sidebar, just scoped to this page instead of the whole nav).
function SectionNavButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-semibold transition lg:w-full ${
        active
          ? 'bg-gold/12 text-gold ring-1 ring-gold/30'
          : 'text-cream-dim hover:bg-white/5 hover:text-cream'
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
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
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-all ${
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

// Labels + messages the shared rules module refers to by key, so the form,
// the validator and the server never spell a rule out twice.
const NUMBER_LABELS = {
  mobileNumber: ['settings.mobileNumber', 'Mobile Number'],
  accountNumberIban: ['settings.accountNumberIban', 'Account Number / IBAN'],
  accountNumber: ['settings.accountNumber', 'Account Number / ID'],
}
const ACCOUNT_ERRORS = {
  errNameRequired: ['settings.errNameRequired', 'Account name is required.'],
  errBankRequired: ['settings.errBankRequired', 'Bank name is required for a bank account.'],
  errNumberRequired: ['settings.errNumberRequired', 'Account number is required.'],
  errNumberWallet: ['settings.accountNumberErrWallet', ERR_WALLET],
  errNumberBank: ['settings.accountNumberErrBank', ERR_BANK],
  errIbanFormat: ['settings.errIbanFormat', 'IBAN must be 24 characters starting with PK.'],
}

// Add / edit dialog for a single online payment account. Which fields show up
// follows the selected type (accountFieldsFor) — a bank needs a bank name, a
// wallet is a mobile number, and SadaPay/NayaPay also carry their own IBAN.
// `onSave` returns `{ error }` from the context (duplicate name) shown inline.
function AccountFormModal({ account, onSave, onClose }) {
  const t = useT()
  const [name, setName] = useState(account?.name || '')
  const [type, setType] = useState(account?.type || ACCOUNT_TYPES[0])
  const [number, setNumber] = useState(account?.number || '')
  // A bank saved before it joined PK_BANKS (or typed by hand) reopens under
  // "Other" rather than silently vanishing from the dropdown.
  const [bank, setBank] = useState(() =>
    !account?.bankName ? '' : PK_BANKS.includes(account.bankName) ? account.bankName : BANK_OTHER,
  )
  const [bankOther, setBankOther] = useState(() =>
    account?.bankName && !PK_BANKS.includes(account.bankName) ? account.bankName : '',
  )
  const [iban, setIban] = useState(account?.iban || '')
  const [error, setError] = useState('')
  useEscapeKey(onClose)

  const isWallet = WALLET_TYPES.includes(type)
  const fields = accountFieldsFor(type)
  const bankName = bank === BANK_OTHER ? bankOther.trim() : bank
  const [numberLabelKey, numberLabelText] = NUMBER_LABELS[fields.numberLabelKey]
  const numberHint = isWallet
    ? t('settings.accountNumberHintWallet', '11 digits — the mobile number (e.g. 03001234567).')
    : fields.needsBank
      ? t(
          'settings.accountNumberHintBank',
          '10, 14 or 16 digits, or a 24-character IBAN (e.g. PK36SCBL0000001123456702).',
        )
      : ''
  const numberPlaceholder = isWallet
    ? '03001234567'
    : fields.needsBank
      ? '12345678901234 or PK36SCBL0000001123456702'
      : ''

  // Switching type changes what each field may contain — re-sanitize the number
  // and drop a bank/IBAN the new type has no field for, instead of carrying a
  // stale value along invisibly.
  const changeType = (next) => {
    const nextFields = accountFieldsFor(next)
    setType(next)
    setNumber((n) => sanitizeAccountNumber(next, n))
    if (!nextFields.needsBank) {
      setBank('')
      setBankOther('')
    }
    if (!nextFields.showsIban) setIban('')
    setError('')
  }

  const save = async () => {
    const payload = {
      name: name.trim(),
      type,
      number: sanitizeAccountNumber(type, number).trim(),
      bankName: fields.needsBank ? bankName : '',
      iban: fields.showsIban ? sanitizeIban(iban) : '',
    }
    const invalid = validateAccount(payload)
    if (invalid) {
      const [key, fallback] = ACCOUNT_ERRORS[invalid] || ACCOUNT_ERRORS.errNameRequired
      return setError(t(key, fallback))
    }
    const res = await onSave(payload)
    if (res?.error) return setError(res.error)
    onClose()
  }

  return (
    <div dir="ltr" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
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
                placeholder="e.g. Zaman Khan"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('settings.accountType', 'Account Type')}
              </label>
              <select className="input" value={type} onChange={(e) => changeType(e.target.value)}>
                {ACCOUNT_TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {ty}
                  </option>
                ))}
              </select>
            </div>
            {fields.needsBank && (
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  {t('settings.bankName', 'Bank Name')} <span className="text-rose-300">*</span>
                </label>
                <select className="input" value={bank} onChange={(e) => setBank(e.target.value)}>
                  <option value="">{t('settings.selectBank', 'Select a bank…')}</option>
                  {PK_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                {bank === BANK_OTHER && (
                  <input
                    className="input mt-2"
                    placeholder={t('settings.bankNameOther', 'Type the bank name')}
                    value={bankOther}
                    onChange={(e) => setBankOther(e.target.value)}
                  />
                )}
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t(numberLabelKey, numberLabelText)}
                {fields.numberRequired && <span className="text-rose-300"> *</span>}
              </label>
              <input
                className="input"
                inputMode={isWallet ? 'numeric' : 'text'}
                placeholder={numberPlaceholder}
                value={number}
                onChange={(e) => setNumber(sanitizeAccountNumber(type, e.target.value))}
              />
              {numberHint && <p className="mt-1.5 text-[11px] text-cream-dim">{numberHint}</p>}
            </div>
            {fields.showsIban && (
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  {t('settings.iban', 'IBAN')}{' '}
                  <span className="normal-case tracking-normal text-cream-dim/70">
                    ({t('common.optional', 'optional')})
                  </span>
                </label>
                <input
                  className="input"
                  placeholder="PK24SADA0000001234567890"
                  value={iban}
                  onChange={(e) => setIban(sanitizeIban(e.target.value))}
                />
                <p className="mt-1.5 text-[11px] text-cream-dim">
                  {t('settings.ibanHint', '24 characters starting with PK — the wallet also works as a bank account.')}
                </p>
              </div>
            )}
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

// Password management. Two jobs in one card: the signed-in Admin changing
// their own password (current password required), and resetting any other
// login account's password — which signs that person's devices out, since the
// old password's sessions must stop working.
function PasswordCard() {
  const t = useT()
  const { user, staff, changeMyPassword, setStaffPassword } = useApp()
  const [target, setTarget] = useState('me')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newRole, setNewRole] = useState('Cashier')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [busy, setBusy] = useState(false)

  // Every active employee, not just the ones that already have credentials —
  // an Admin can hand a login to a staff row that was created without one
  // (Employees page never writes credentials), so the picker must list them.
  const people = useMemo(
    () => staff.filter((s) => s.active !== false && s.id !== user?.id),
    [staff, user?.id],
  )

  const isSelf = target === 'me'
  const who = people.find((s) => s.id === target)
  const needsLogin = !isSelf && who && !who.username

  const reset = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setNewUsername('')
    setNewRole('Cashier')
  }
  const changeTarget = (value) => {
    setTarget(value)
    setError('')
    setDone('')
    reset()
  }

  const submit = async () => {
    setError('')
    setDone('')
    if (needsLogin && !newUsername.trim())
      return setError(t('settings.pwUsernameRequired', 'Choose a username for this employee.'))
    if (next.length < 6) return setError(t('settings.pwTooShort', 'Password must be at least 6 characters.'))
    if (next !== confirm) return setError(t('settings.pwMismatch', 'The two passwords do not match.'))
    setBusy(true)
    const res = isSelf
      ? await changeMyPassword({ currentPassword: current, newPassword: next })
      : await setStaffPassword(target, next, {
          username: newUsername.trim().toLowerCase(),
          systemRole: newRole,
        })
    setBusy(false)
    if (res?.error) return setError(res.error)
    setDone(
      isSelf
        ? t('settings.pwChangedSelf', 'Your password has been changed.')
        : needsLogin
          ? t('settings.pwLoginCreated', 'Login created. {name} can now sign in.').replace('{name}', who?.name || '')
          : t('settings.pwChangedOther', 'Password changed. That user must log in again.').replace('{name}', who?.name || ''),
    )
    reset()
  }

  return (
    <div className="card max-w-2xl p-6">
      <div className="flex items-center gap-3 border-b border-ink-line pb-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
          <IconLock size={20} />
        </span>
        <div>
          <h3 className="font-serif text-xl text-cream">{t('settings.passwords', 'Login Passwords')}</h3>
          <p className="text-xs text-cream-dim">
            {t('settings.passwordsDesc', 'Change your own password, or set a new one for any staff login.')}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
            {t('settings.pwWhose', 'Whose password')}
          </label>
          <select className="input" value={target} onChange={(e) => changeTarget(e.target.value)}>
            <option value="me">
              {t('settings.pwMine', 'My password')} — {user?.name} ({user?.role})
            </option>
            {people.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.systemRole || s.role || '—'}) ·{' '}
                {s.username || t('settings.pwNoLogin', 'no login yet')}
              </option>
            ))}
          </select>
        </div>

        {/* First-time login for an employee added without credentials. */}
        {needsLogin && (
          <div className="space-y-4 rounded-xl border border-gold/25 bg-gold/[0.05] p-4">
            <p className="text-xs text-gold">
              {t('settings.pwNoLoginHint', '{name} has no login yet — set a username and role to create one.').replace(
                '{name}',
                who?.name || '',
              )}
            </p>
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('settings.pwUsername', 'Username')} <span className="text-rose-300">*</span>
              </label>
              <input
                className="input"
                autoComplete="off"
                placeholder={t('settings.pwUsernamePh', 'e.g. waiter1')}
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('settings.pwSystemRole', 'System role')} <span className="text-rose-300">*</span>
              </label>
              <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                {['Admin', 'Manager', 'Cashier', 'Kitchen'].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {isSelf && (
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
              {t('settings.pwCurrent', 'Current Password')} <span className="text-rose-300">*</span>
            </label>
            <PasswordInput
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
            {t('settings.pwNew', 'New Password')} <span className="text-rose-300">*</span>
          </label>
          <PasswordInput
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
            {t('settings.pwConfirm', 'Confirm New Password')} <span className="text-rose-300">*</span>
          </label>
          <PasswordInput
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {!isSelf && !needsLogin && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {t('settings.pwResetWarning', 'This user will be signed out of every device and must log in with the new password.')}
          </p>
        )}
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
        {done && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{done}</p>}

        <button onClick={submit} disabled={busy} className="btn-gold px-5 py-2.5 text-sm disabled:opacity-60">
          <IconCheck size={16} />{' '}
          {needsLogin ? t('settings.pwCreateLogin', 'Create Login') : t('settings.pwSave', 'Change Password')}
        </button>
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
    maxCashierDiscountPercent,
    setMaxCashierDiscountPercent,
    whatsappReport,
    setWhatsappReportConfig,
    attendanceDevice,
    setAttendanceDeviceConfig,
    onlineAccounts,
    addOnlineAccount,
    updateOnlineAccount,
    toggleOnlineAccount,
    whatsappRecipients,
    addWhatsappRecipient,
    recheckWhatsappRecipient,
    removeWhatsappRecipient,
    user,
  } = useApp()
  const t = useT()
  const canEdit = user && canModify(user.role, 'settings')
  const ratePct = Math.round(gstRate * 100)
  const fill = (s) => s.replace('{rate}', ratePct)
  const [formFor, setFormFor] = useState(null) // 'new' | account object | null

  // WhatsApp recipient allowlist — "add" round-trips to Meta (see
  // AppContext.jsx's addWhatsappRecipient), so it needs its own busy/error
  // state rather than the instant local-only toggles elsewhere on this page.
  const [newRecipientPhone, setNewRecipientPhone] = useState('')
  const [recipientBusy, setRecipientBusy] = useState(false) // true | id being rechecked/removed | false
  const [recipientError, setRecipientError] = useState('')

  const submitNewRecipient = async () => {
    setRecipientError('')
    setRecipientBusy(true)
    const res = await addWhatsappRecipient({ phone: newRecipientPhone })
    setRecipientBusy(false)
    if (res?.error) return setRecipientError(res.error)
    setNewRecipientPhone('')
  }
  const runRecheck = async (id) => {
    setRecipientError('')
    setRecipientBusy(id)
    const res = await recheckWhatsappRecipient(id)
    setRecipientBusy(false)
    if (res?.error) setRecipientError(res.error)
  }
  const runRemove = async (id) => {
    setRecipientError('')
    setRecipientBusy(id)
    const res = await removeWhatsappRecipient(id)
    setRecipientBusy(false)
    if (res?.error) setRecipientError(res.error)
  }

  // Left-nav sections — was one long stack of cards, which read as cluttered
  // once Server Health / Passwords were added on top of Tax/WhatsApp/Accounts.
  // A left panel + single-section right content mirrors how every other
  // multi-area settings screen (macOS, most SaaS admin panels) organizes this.
  const sections = [
    { key: 'tax', label: t('settings.taxSection'), icon: IconReceipt },
    { key: 'whatsapp', label: t('settings.whatsappSection', 'WhatsApp Daily Report'), icon: IconWhatsApp },
    { key: 'attendance', label: t('settings.attendanceSection', 'Attendance Machine'), icon: IconAttendance },
    { key: 'accounts', label: t('settings.onlineAccounts', 'Online Payment Accounts'), icon: IconWallet },
    ...(canEdit ? [{ key: 'printer', label: t('settings.printerSection', 'Receipt Printer'), icon: IconPrint }] : []),
    ...(canEdit ? [{ key: 'server', label: t('settings.serverHealth', 'Server Health'), icon: IconClock }] : []),
    ...(canEdit ? [{ key: 'password', label: t('settings.passwords', 'Login Passwords'), icon: IconLock }] : []),
  ]
  const [section, setSection] = useState('tax')

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

  // Ceiling on a Cashier's Apply Discount (frontend + server-enforced in
  // orders.service.ts's applyDiscount) — same editable-draft/Save shape as
  // the GST rate field above.
  const [maxDiscountInput, setMaxDiscountInput] = useState(String(maxCashierDiscountPercent))
  const [maxDiscountError, setMaxDiscountError] = useState('')
  const [maxDiscountSaved, setMaxDiscountSaved] = useState(false)
  const saveMaxDiscount = async () => {
    const res = await setMaxCashierDiscountPercent(maxDiscountInput)
    if (res?.error) {
      setMaxDiscountSaved(false)
      return setMaxDiscountError(res.error)
    }
    setMaxDiscountError('')
    setMaxDiscountSaved(true)
    setTimeout(() => setMaxDiscountSaved(false), 2000)
  }

  // WhatsApp daily report (requirements.md §6/§7) — hour + recipient are
  // edited as a draft and written back together on Save, same shape as the
  // GST rate field above; the enabled toggle writes immediately like GST's.
  const [waHourInput, setWaHourInput] = useState(String(whatsappReport.hour))
  const [waRecipientInput, setWaRecipientInput] = useState(whatsappReport.recipient)
  const fillHour = (s) => s.replace('{hour}', String(whatsappReport.hour).padStart(2, '0'))
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

  // Attendance machine (ZKTeco uFace 950) — IP/port live in the database
  // (AppSettings), not an env var, so this Save button is the entire setup:
  // no config file, no restart. Same draft-then-Save shape as WhatsApp above.
  const [attIpInput, setAttIpInput] = useState(attendanceDevice.ip)
  const [attPortInput, setAttPortInput] = useState(String(attendanceDevice.port))
  const [attError, setAttError] = useState('')
  const [attSaved, setAttSaved] = useState(false)
  useEffect(() => {
    setAttIpInput(attendanceDevice.ip)
    setAttPortInput(String(attendanceDevice.port))
  }, [attendanceDevice.ip, attendanceDevice.port])
  const saveAttendanceDeviceConfig = async () => {
    const res = await setAttendanceDeviceConfig({ ip: attIpInput, port: Number(attPortInput) })
    if (res?.error) {
      setAttSaved(false)
      return setAttError(res.error)
    }
    setAttError('')
    setAttSaved(true)
    setTimeout(() => setAttSaved(false), 2000)
  }

  // "Scan for device" — sweeps the server's own LAN subnet instead of
  // requiring the IP be typed in (see attendanceDeviceDiscovery.service.ts
  // for why a true zero-touch broadcast search isn't safe to build). A
  // single match fills the field automatically; more than one (or zero)
  // leaves it to the admin to pick/investigate.
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState(null) // null = not run yet
  const [scanError, setScanError] = useState('')
  const scanForDevice = async () => {
    setScanning(true)
    setScanError('')
    setScanResults(null)
    try {
      const res = await apiPost('/api/system/attendance-scan')
      const devices = res.devices || []
      setScanResults(devices)
      if (devices.length === 1) setAttIpInput(devices[0])
    } catch (err) {
      setScanError(err.message)
    } finally {
      setScanning(false)
    }
  }

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left panel — horizontal pill row on narrow screens, vertical list from lg: up */}
        <nav className="flex gap-2 overflow-x-auto pb-1 lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-visible lg:pb-0">
          {sections.map((s) => (
            <SectionNavButton
              key={s.key}
              active={section === s.key}
              icon={s.icon}
              label={s.label}
              onClick={() => setSection(s.key)}
            />
          ))}
        </nav>

        {/* Right content — one section at a time */}
        <div className="min-w-0 max-w-2xl flex-1 space-y-6">

      {/* Tax & GST */}
      {section === 'tax' && (
      <div className="card p-6">
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

        {/* Cashier's Apply Discount is capped at this — 0 means Cashier can't
            discount at all until this is set. Admin/Manager are unaffected
            (their `discount` permission is 'full', not this capped 'edit'). */}
        <div className="mt-5 border-t border-ink-line pt-5">
          <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
            {t('settings.maxCashierDiscountLabel', 'Max Cashier Discount (%)')}
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.5"
              className="input w-32"
              value={maxDiscountInput}
              onChange={(e) => setMaxDiscountInput(e.target.value)}
              disabled={!canEdit}
            />
            {canEdit && (
              <button onClick={saveMaxDiscount} className="btn-gold px-5 py-2.5 text-sm">
                {t('common.save', 'Save')}
              </button>
            )}
            {maxDiscountError && <span className="text-xs text-rose-300">{maxDiscountError}</span>}
            {maxDiscountSaved && (
              <span className="text-xs text-emerald-300">
                {t('settings.maxDiscountSaved', 'Limit updated.')}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-cream-dim">
            {t(
              'settings.maxCashierDiscountHint',
              'The highest discount a Cashier can apply to a bill. Admin and Manager are unlimited.',
            )}
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
      )}

      {/* WhatsApp daily report */}
      {section === 'whatsapp' && (
      <div className="card p-6">
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

        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-ink-line pt-5 sm:grid-cols-[140px_1fr]">
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
              {t('settings.whatsappHourLabel', 'Send hour (24h)')}
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={23}
              step="1"
              className="input w-full"
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

        <div
          className={`mt-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-medium ${
            whatsappReport.enabled
              ? 'border-gold/25 bg-gold/[0.06] text-gold'
              : 'border-ink-line bg-ink-soft/50 text-cream-dim'
          }`}
        >
          <IconWhatsApp size={14} />
          {whatsappReport.enabled
            ? fillHour(t('settings.whatsappStatusOn', 'Automated send is ON — sends daily at {hour}:00.'))
            : t('settings.whatsappStatusOff', 'Automated send is OFF — nothing sends automatically.')}
        </div>

        <p className="mt-3 text-xs text-cream-dim">
          {t(
            'settings.whatsappHint',
            'Digits only, country code first, no leading + (e.g. 923001234567). The admin can also request the latest report any time by messaging the system directly on WhatsApp.',
          )}
        </p>

        {/* Recipient allowlist — Meta's test-mode API has no way to list which
            numbers are already approved, so "Add" here actually attempts a real
            send and reports back what Meta says. */}
        <div className="mt-6 border-t border-ink-line pt-5">
          <h4 className="font-serif text-lg text-cream">
            {t('settings.whatsappRecipientsTitle', 'Approved Recipients')}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-cream-dim">
            {t(
              'settings.whatsappRecipientsDesc',
              'Meta only allows this WhatsApp number to message numbers explicitly added and OTP-verified in the Meta App Dashboard first — up to 5 at a time in test mode. Add a number here to check whether it has already been approved there.',
            )}
          </p>

          {canEdit && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                placeholder="923001234567"
                className="input w-56"
                value={newRecipientPhone}
                onChange={(e) => setNewRecipientPhone(e.target.value)}
                disabled={recipientBusy === true || whatsappRecipients.length >= 5}
              />
              <button
                onClick={submitNewRecipient}
                disabled={recipientBusy === true || !newRecipientPhone.trim() || whatsappRecipients.length >= 5}
                className="btn-gold px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconPlus size={16} />
                {recipientBusy === true ? t('settings.whatsappRecipientChecking', 'Checking…') : t('settings.whatsappRecipientAdd', 'Add & Check')}
              </button>
              {recipientError && <span className="text-xs text-rose-300">{recipientError}</span>}
            </div>
          )}

          <p className="mt-2 text-[11px] text-cream-dim">
            {whatsappRecipients.length >= 5
              ? t('settings.whatsappRecipientsLimitReached', 'Limit reached (5/5) — remove one below to add another.')
              : t('settings.whatsappRecipientsLimit', '{count}/5 numbers used — Meta’s test-mode maximum.').replace(
                  '{count}',
                  whatsappRecipients.length,
                )}
          </p>

          {whatsappRecipients.length === 0 ? (
            <p className="mt-4 rounded-xl border border-ink-line bg-ink-soft/50 px-4 py-5 text-center text-xs text-cream-dim">
              {t('settings.whatsappRecipientsNone', 'No numbers added yet.')}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-ink-line">
              {whatsappRecipients.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold text-cream">
                      {r.phone}
                      <span
                        className={`badge ring-1 ${
                          r.verified
                            ? 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/30'
                            : 'bg-amber-500/12 text-amber-300 ring-amber-500/30'
                        }`}
                      >
                        {r.verified
                          ? t('settings.whatsappRecipientVerified', 'Added on Meta')
                          : t('settings.whatsappRecipientNotVerified', 'Not added yet')}
                      </span>
                    </p>
                    {!r.verified && (
                      <p className="mt-0.5 text-xs text-cream-dim">
                        {t(
                          'settings.whatsappRecipientHint',
                          'Add this number in the Meta App Dashboard (WhatsApp → API Setup → recipient list), then click Recheck.',
                        )}
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      {!r.verified && (
                        <button
                          onClick={() => runRecheck(r.id)}
                          disabled={recipientBusy === r.id}
                          className="flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <IconRefresh size={13} className={recipientBusy === r.id ? 'animate-spin' : ''} />
                          {t('settings.whatsappRecipientRecheck', 'Recheck')}
                        </button>
                      )}
                      <button
                        onClick={() => runRemove(r.id)}
                        disabled={recipientBusy === r.id}
                        className="rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 text-xs font-semibold text-cream-dim transition hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t('common.delete', 'Delete')}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      )}

      {/* Attendance machine (ZKTeco uFace 950) */}
      {section === 'attendance' && (
      <div className="card p-6">
        <div className="flex items-center gap-3 border-b border-ink-line pb-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold ring-1 ring-gold/25">
            <IconAttendance size={20} />
          </span>
          <div>
            <h3 className="font-serif text-xl text-cream">
              {t('settings.attendanceSection', 'Attendance Machine')}
            </h3>
            <p className="text-xs text-cream-dim">
              {t('settings.attendanceDesc', 'Connect the on-site fingerprint/face attendance terminal.')}
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-ink-line pt-5">
            <button
              onClick={scanForDevice}
              disabled={scanning}
              className="btn-ghost px-4 py-2.5 text-sm disabled:opacity-60"
            >
              <IconRefresh size={14} className={scanning ? 'animate-spin' : ''} />
              {scanning
                ? t('settings.attendanceScanning', 'Scanning your network…')
                : t('settings.attendanceScan', 'Scan for device')}
            </button>
            {scanError && <span className="text-xs text-rose-300">{scanError}</span>}
          </div>
        )}
        {scanResults && (
          <div className="mt-3 text-xs">
            {scanResults.length === 0 && (
              <p className="text-cream-dim">
                {t(
                  'settings.attendanceScanEmpty',
                  'No device found on this network. Make sure it’s powered on and connected via Ethernet to the same network as this server.',
                )}
              </p>
            )}
            {scanResults.length === 1 && (
              <p className="text-emerald-300">
                {t('settings.attendanceScanFound', 'Found a device at {ip} — filled in below.').replace('{ip}', scanResults[0])}
              </p>
            )}
            {scanResults.length > 1 && (
              <div>
                <p className="mb-1.5 text-cream-dim">
                  {t('settings.attendanceScanMultiple', 'Found more than one — pick the right one:')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {scanResults.map((ip) => (
                    <button
                      key={ip}
                      onClick={() => setAttIpInput(ip)}
                      className={`rounded-lg border px-3 py-1.5 font-mono transition ${
                        attIpInput === ip
                          ? 'border-gold/40 bg-gold/10 text-gold'
                          : 'border-ink-line text-cream-dim hover:border-gold/30 hover:text-cream'
                      }`}
                    >
                      {ip}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-ink-line pt-5 sm:grid-cols-[1fr_120px]">
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
              {t('settings.attendanceIpLabel', 'Machine IP address')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="192.168.1.201"
              className="input w-full"
              value={attIpInput}
              onChange={(e) => setAttIpInput(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
              {t('settings.attendancePortLabel', 'Port')}
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={65535}
              className="input w-full"
              value={attPortInput}
              onChange={(e) => setAttPortInput(e.target.value)}
              disabled={!canEdit}
            />
          </div>
        </div>

        {canEdit && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={saveAttendanceDeviceConfig} className="btn-gold px-5 py-2.5 text-sm">
              {t('common.save', 'Save')}
            </button>
            {attError && <span className="text-xs text-rose-300">{attError}</span>}
            {attSaved && <span className="text-xs text-emerald-300">{t('settings.attendanceSaved', 'Saved.')}</span>}
          </div>
        )}

        <div
          className={`mt-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-medium ${
            attendanceDevice.ip
              ? 'border-gold/25 bg-gold/[0.06] text-gold'
              : 'border-ink-line bg-ink-soft/50 text-cream-dim'
          }`}
        >
          <IconAttendance size={14} />
          {attendanceDevice.ip
            ? t('settings.attendanceStatusOn', 'Connected — punches sync automatically in the background.')
            : t('settings.attendanceStatusOff', 'Not set up yet — enter the machine’s IP address above.')}
        </div>

        <p className="mt-3 text-xs text-cream-dim">
          {t(
            'settings.attendanceHint',
            'Find the IP on the machine itself: Menu → Comm. → Ethernet. A fixed (non-DHCP) IP set on the device is recommended so this never needs updating after a power cycle.',
          )}
        </p>
      </div>
      )}

      {/* Online payment accounts */}
      {section === 'accounts' && (
      <div className="card p-6">
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
                    {[a.type, a.bankName, a.number, a.iban].filter(Boolean).join(' · ')}
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
      )}

      {/* Receipt printer — Admin-only, same gate as the rest of this page */}
      {section === 'printer' && canEdit && <PrinterSettingsPanel />}

      {/* Server health — Admin-only, same gate as the rest of this page */}
      {section === 'server' && canEdit && <ServerHealthPanel />}

      {/* Password management — Admin-only, same gate as the rest of this page */}
      {section === 'password' && canEdit && <PasswordCard />}

        </div>
      </div>

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
