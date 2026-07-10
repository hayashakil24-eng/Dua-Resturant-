import { useEffect, useRef } from 'react'

// Shared stack so that when modals are nested (e.g. the discount modal on top
// of the receipt), pressing Escape only closes the topmost one.
const stack = []

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || stack.length === 0) return
    stack[stack.length - 1]()
  })
}

// Calls `handler` when Escape is pressed, but only while this is the
// most-recently-mounted consumer. Used by modals so Esc closes them — the
// standard, expected UX. Registers once on mount (via a ref) so an inline
// handler that changes identity each render doesn't reorder the stack.
export function useEscapeKey(handler) {
  const ref = useRef(handler)
  ref.current = handler

  useEffect(() => {
    const entry = () => ref.current()
    stack.push(entry)
    return () => {
      const i = stack.lastIndexOf(entry)
      if (i !== -1) stack.splice(i, 1)
    }
  }, [])
}
