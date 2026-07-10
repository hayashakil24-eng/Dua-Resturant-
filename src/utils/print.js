// Guarded print — prevents duplicate jobs from rapid double-clicks or
// re-renders. Keeps the app's CSS-based printing (@media print in index.css
// targets #printable-receipt / #printable-report), so styling is unchanged.

let printing = false
let lastPrintAt = 0
const DEBOUNCE_MS = 1500

// Returns true if the print was triggered, false if it was suppressed.
// `bodyClass` (optional) is added to <body> for the duration of the print so
// print CSS can scope itself — e.g. the receipt collapses the app behind it so
// it prints on a single page (see @media print in index.css).
export function safePrint(bodyClass) {
  const now = Date.now()
  if (printing || now - lastPrintAt < DEBOUNCE_MS) return false

  printing = true
  lastPrintAt = now
  // Guard: safePrint is also used directly as an onClick handler, where the
  // first arg is the event object rather than a class name.
  const cls = typeof bodyClass === 'string' ? bodyClass : ''
  if (cls) document.body.classList.add(cls)

  const release = () => {
    printing = false
    if (cls) document.body.classList.remove(cls)
  }
  // Reset when the print dialog closes; fallback in case it never fires.
  window.addEventListener('afterprint', release, { once: true })
  setTimeout(release, 3000)

  window.print()
  return true
}
