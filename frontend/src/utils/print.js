// Guarded print — prevents duplicate jobs from rapid double-clicks or
// re-renders. Keeps the app's CSS-based printing (@media print in index.css
// targets #printable-receipt / #printable-report), so styling is unchanged.

// Keyed by bodyClass (print surface) — was a pair of module-level singletons
// shared across every surface, so printing a KOT and then a receipt within
// the debounce window silently suppressed the receipt (each surface only
// cares about repeats of *itself*, not another surface entirely).
const debounceState = new Map() // bodyClass -> { printing, lastPrintAt }
const DEBOUNCE_MS = 1500

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
  // Reset when the print dialog closes; fallback in case it never fires.
  window.addEventListener('afterprint', release, { once: true })
  setTimeout(release, 3000)

  window.print()
  return true
}
