// Guarded print — prevents duplicate jobs from rapid double-clicks or
// re-renders. Keeps the app's CSS-based print SCOPING (@media print in
// index.css targets #printable-receipt / #printable-report via the
// body.print-x class below) — receipt styling is unchanged either way.
//
// The actual "fire the print job" step goes through Electron's silent native
// printing (electron/main.js's webContents.print({ silent: true }), via IPC —
// preload.js's printSilent) instead of window.print(), which opens
// Chromium's own print dialog (Destination/Pages/Layout/Colour/Print/Cancel).
// A browser dev session (NO_ELECTRON=1, no window.electron) has no IPC to
// call, so it falls back to window.print() — the existing browser dev loop
// keeps working unchanged.

// Keyed by bodyClass (print surface) — was a pair of module-level singletons
// shared across every surface, so printing a KOT and then a receipt within
// the debounce window silently suppressed the receipt (each surface only
// cares about repeats of *itself*, not another surface entirely).
const debounceState = new Map() // bodyClass -> { printing, lastPrintAt }
const DEBOUNCE_MS = 1500

// Print failures can originate from any of a dozen call sites (Orders,
// Closing, SessionHistory, POS, KitchenSlips, Billing, ...) — rather than
// thread error state through each of them, failures are reported here via a
// single handler that PrintErrorToast.jsx registers once at the app root.
let onPrintError = () => {}
export function setPrintErrorHandler(fn) {
  onPrintError = fn || (() => {})
}

// The printer an Admin picked in Settings → Receipt Printer (see
// PrinterSettingsPanel), same localStorage-preference convention
// LanguageContext.jsx already uses for `lang` — read directly rather than
// through React state so it stays correct even from a call site that never
// mounted the settings page. Unset (never configured) → undefined, which
// main.js's print-silent handler treats as "use the OS default printer",
// never a guessed name like "Microsoft Print to PDF".
const configuredPrinter = () => localStorage.getItem('receiptPrinter') || undefined

// Returns true if the print was triggered, false if it was suppressed.
// `bodyClass` (optional) is added to <body> for the duration of the print so
// print CSS can scope itself — e.g. the receipt collapses the app behind it so
// it prints on a single page (see @media print in index.css).
export function safePrint(bodyClass) {
  // Guard: safePrint is also used directly as an onClick handler, where the
  // first arg is the event object rather than a class name.
  const cls = typeof bodyClass === 'string' ? bodyClass : ''
  const key = cls || '__default__'
  const state = debounceState.get(key) || { printing: false, lastPrintAt: 0 }

  const now = Date.now()
  if (state.printing || now - state.lastPrintAt < DEBOUNCE_MS) return false

  state.printing = true
  state.lastPrintAt = now
  debounceState.set(key, state)

  // Only one print surface may be visually active at a time — strip any
  // other surface's class first (print-to-PDF drivers often never fire
  // `afterprint`, so a previous one can linger and its portaled slip would
  // overlap this print), but this is purely a DOM/CSS concern, unrelated to
  // each surface's own independent debounce lock above.
  Array.from(document.body.classList)
    .filter((c) => c.startsWith('print-'))
    .forEach((c) => document.body.classList.remove(c))
  if (cls) document.body.classList.add(cls)

  const release = () => {
    state.printing = false
    if (cls) document.body.classList.remove(cls)
  }

  if (window.electron?.printSilent) {
    window.electron
      .printSilent(configuredPrinter())
      .then((res) => {
        if (!res?.success) onPrintError(res?.error || 'Print failed.')
      })
      .catch((err) => onPrintError(err?.message || 'Print failed.'))
      .finally(release)
  } else {
    // Browser dev mode (NO_ELECTRON=1) — no IPC to call, fall back to the
    // browser's own print dialog so the dev loop still works.
    window.addEventListener('afterprint', release, { once: true })
    setTimeout(release, 3000)
    window.print()
  }
  return true
}
