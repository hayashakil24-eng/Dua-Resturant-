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

// Reports (Summary/Item-Wise/KOT Report/History/Daily Ledger/Cafe Session)
// print via the OS/Electron native print dialog instead of safePrint()'s
// silent Chromium pipeline above — deliberately, not an oversight. A report
// is a full paginated HTML page (unlike the receipt/KOT dockets), so it
// can't move to raw ESC/POS the way those did; and safePrint's silent
// webContents.print() is exactly what fails with "Invalid printer settings"
// against real thermal-printer drivers (see PRINTER_ISSUE_HANDOFF.md) — the
// visible dialog sidesteps that failure mode entirely, since Chromium only
// issues the problematic page-size/margin capability query on the SILENT
// path; a human picking a destination and clicking Print never triggers it.
// This also matches the "Save PDF" half of this button's label — the native
// dialog lets staff pick "Microsoft Print to PDF" as the destination.
// Same debounce/class-scoping shape as safePrint so behavior stays
// consistent, but nothing here is silent or automatic: the user must
// actively click Print (or Cancel) in a real dialog, so — unlike a fired-
// and-forgotten silent job — a bad driver can always be cancelled by hand
// before anything reaches the printer.
export function printReportDialog(bodyClass) {
  const cls = typeof bodyClass === 'string' ? bodyClass : ''
  const key = cls || '__default__'
  const state = debounceState.get(key) || { printing: false, lastPrintAt: 0 }

  const now = Date.now()
  if (state.printing || now - state.lastPrintAt < DEBOUNCE_MS) return false

  state.printing = true
  state.lastPrintAt = now
  debounceState.set(key, state)

  Array.from(document.body.classList)
    .filter((c) => c.startsWith('print-'))
    .forEach((c) => document.body.classList.remove(c))
  if (cls) document.body.classList.add(cls)

  const release = () => {
    state.printing = false
    if (cls) document.body.classList.remove(cls)
  }
  window.addEventListener('afterprint', release, { once: true })
  setTimeout(release, 3000)
  window.print()
  return true
}

// Raw ESC/POS printing — see electron/rawPrint.js and src/utils/escpos.js
// for why safePrint() above (which goes through Chromium's silent print
// pipeline) can't be trusted on real thermal-printer drivers on this
// Electron version. Same debounce/error-reporting shape as safePrint so
// call sites and PrintErrorToast.jsx behave identically either way;
// `buildBytes` is called lazily (only once we know a raw print will
// actually be attempted) since it does real work (formatting the whole
// receipt/docket). `fallback` runs instead when there's no `printRaw` IPC to
// call through (browser dev mode, NO_ELECTRON=1) — each surface supplies
// its own, since what a surface needs to do to fall back differs (the
// receipt can just re-run the HTML print path; a KOT docket first needs its
// caller to render the print-scoped DOM via KitchenSlips.jsx).
function printRawJob(cls, buildBytes, fallback) {
  const state = debounceState.get(cls) || { printing: false, lastPrintAt: 0 }
  const now = Date.now()
  if (state.printing || now - state.lastPrintAt < DEBOUNCE_MS) return false
  state.printing = true
  state.lastPrintAt = now
  debounceState.set(cls, state)
  const release = () => {
    state.printing = false
  }

  if (window.electron?.printRaw) {
    let bytes
    try {
      bytes = buildBytes()
    } catch (err) {
      release()
      onPrintError(err?.message || 'Could not prepare the print job.')
      return false
    }
    window.electron
      .printRaw(configuredPrinter(), bytes)
      .then((res) => {
        if (!res?.success) onPrintError(res?.error || 'Print failed.')
      })
      .catch((err) => onPrintError(err?.message || 'Print failed.'))
      .finally(release)
    return true
  }

  // Browser dev mode (NO_ELECTRON=1) — no IPC to call raw-print through.
  release()
  return fallback()
}

export function printReceiptRaw(buildBytes) {
  return printRawJob('print-receipt', buildBytes, () => safePrint('print-receipt'))
}

export function printKotRaw(buildBytes, fallback) {
  return printRawJob('print-kot', buildBytes, fallback)
}
