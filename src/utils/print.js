// Guarded print — prevents duplicate jobs from rapid double-clicks or
// re-renders. Keeps the app's CSS-based printing (@media print in index.css
// targets #printable-receipt / #printable-report), so styling is unchanged.

let printing = false
let lastPrintAt = 0
const DEBOUNCE_MS = 1500

// Returns true if the print was triggered, false if it was suppressed.
export function safePrint() {
  const now = Date.now()
  if (printing || now - lastPrintAt < DEBOUNCE_MS) return false

  printing = true
  lastPrintAt = now

  const release = () => {
    printing = false
  }
  // Reset when the print dialog closes; fallback in case it never fires.
  window.addEventListener('afterprint', release, { once: true })
  setTimeout(release, 3000)

  window.print()
  return true
}
