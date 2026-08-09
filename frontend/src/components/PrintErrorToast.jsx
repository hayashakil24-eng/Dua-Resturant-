import { useEffect, useState } from 'react'
import { setPrintErrorHandler } from '../utils/print.js'
import { IconAlert, IconClose } from './Icons.jsx'

// Mounted once at the app root (App.jsx) so any of safePrint()'s call sites
// (Orders, Closing, SessionHistory, POS, KitchenSlips, Billing, ...) can
// report a silent-print failure without each one threading its own error
// state through — see print.js's setPrintErrorHandler.
export default function PrintErrorToast() {
  const [message, setMessage] = useState(null)

  useEffect(() => {
    setPrintErrorHandler((msg) => setMessage(msg))
    return () => setPrintErrorHandler(null)
  }, [])

  useEffect(() => {
    if (!message) return undefined
    const id = setTimeout(() => setMessage(null), 6000)
    return () => clearTimeout(id)
  }, [message])

  if (!message) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex max-w-sm items-start gap-3 rounded-xl border border-rose-500/30 bg-ink-soft px-4 py-3 shadow-lift animate-fade-up">
      <IconAlert size={18} className="mt-0.5 shrink-0 text-rose-300" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-cream">Print failed</p>
        <p className="mt-0.5 break-words text-xs text-cream-dim">{message}</p>
      </div>
      <button onClick={() => setMessage(null)} className="shrink-0 text-cream-dim hover:text-cream">
        <IconClose size={16} />
      </button>
    </div>
  )
}
