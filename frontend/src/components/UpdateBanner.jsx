import { useEffect, useState } from 'react'
import { useT } from '../i18n/LanguageContext.jsx'
import { IconRefresh, IconClose } from './Icons.jsx'

// Surfaces main.js's autoUpdater events (electron-updater, see electron/main.js
// and electron/preload.js). Only ever shows a *found* update — a failed/offline
// check is deliberately silent there, since this restaurant's internet is
// unreliable and that's the normal state, not an error worth interrupting a
// cashier over. Renders nothing outside Electron (no window.electron) or
// before any update event has fired.
export default function UpdateBanner() {
  const t = useT()
  const [update, setUpdate] = useState(null) // { version, ready }
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!window.electron?.onUpdateAvailable) return
    window.electron.onUpdateAvailable(({ version }) => setUpdate((u) => u ?? { version, ready: false, percent: 0 }))
    window.electron.onUpdateDownloadProgress(({ percent }) => setUpdate((u) => (u ? { ...u, percent } : u)))
    window.electron.onUpdateDownloaded(({ version }) => setUpdate((u) => ({ ...u, version, ready: true, percent: 100 })))
  }, [])

  if (!update || dismissed) return null

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="card flex items-center gap-3 px-4 py-3 shadow-lift">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold/10 text-gold ring-1 ring-gold/25">
          <IconRefresh size={18} className={update.ready ? '' : 'animate-spin'} />
        </div>
        <div className="min-w-[220px]">
          <p className="text-sm text-cream">
            {update.ready
              ? t('update.ready').replace('{version}', update.version)
              : t('update.downloading').replace('{version}', update.version).replace('{percent}', update.percent ?? 0)}
          </p>
          {!update.ready && (
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink-soft">
              <div
                className="h-full rounded-full bg-gold-grad transition-[width] duration-300"
                style={{ width: `${update.percent ?? 0}%` }}
              />
            </div>
          )}
        </div>
        {update.ready && (
          <button className="btn-gold shrink-0 px-3 py-1.5 text-sm" onClick={() => window.electron.installUpdate()}>
            {t('update.restartNow')}
          </button>
        )}
        <button
          className="shrink-0 text-cream-dim transition hover:text-gold"
          onClick={() => setDismissed(true)}
          aria-label={t('update.later')}
          title={t('update.later')}
        >
          <IconClose size={16} />
        </button>
      </div>
    </div>
  )
}
