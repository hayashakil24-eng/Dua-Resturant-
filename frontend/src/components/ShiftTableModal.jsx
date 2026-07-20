import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { tableLabel } from '../data/mockData.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { IconClose, IconTable, IconCheck, IconSearch } from './Icons.jsx'

const PAGE_SIZE = 12 // 3 rows × 4 cols — a restaurant can have 100+ tables, so
// the picker searches + paginates rather than rendering every table at once.

// Page numbers to render with … gaps: always first/last + a window around the
// current page (e.g. 1 … 4 5 6 … 12), so the control stays compact for many pages.
function pageWindow(current, count) {
  const pages = new Set([1, count, current, current - 1, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b)
  const out = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
}

// Move a running order to another table (the party physically changed seats).
// A destination is picked from the configured tables; occupied tables are shown
// but flagged, since moving onto one leaves two running orders on it (no merge —
// the Tables page already handles more than one order per table). onConfirm(id).
export default function ShiftTableModal({ order, onClose, onConfirm }) {
  const { tables, orders } = useApp()
  const [dest, setDest] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  useEscapeKey(onClose)

  // Tables currently holding a running (unpaid, non-cancelled) order — used only
  // to flag the picker, not to disable, so a genuine merge-onto-seat is allowed.
  const occupied = useMemo(
    () =>
      new Set(
        orders
          .filter((o) => o.payment === 'Unpaid' && !o.cancelled && o.id !== order.id)
          .map((o) => o.table),
      ),
    [orders, order.id],
  )

  const options = useMemo(
    () => tables.filter((tbl) => tbl.id !== order.table && !tbl.locked),
    [tables, order.table],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((tbl) => (tbl.number || `T${tbl.id}`).toLowerCase().includes(q))
  }, [options, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  // Clamp during render (filtering can shrink the list below the current page)
  // so we never show an empty page without threading an effect through.
  const safePage = Math.min(page, pageCount)
  const shown = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const onSearch = (v) => {
    setQuery(v)
    setPage(1) // a new search always restarts at the first page of results
  }

  const confirm = () => {
    if (dest == null) {
      setError('Select a table to move this order to.')
      return
    }
    onConfirm(dest)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">Shift Table</h3>
              <p className="mt-0.5 text-xs text-cream-dim">Move this running order to a different table. Recorded in the audit log.</p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          {/* From → summary */}
          <div className="mt-5 flex items-center justify-between rounded-xl border border-ink-line bg-ink-soft p-4">
            <span className="font-semibold text-gold">{order.id}</span>
            <span className="flex items-center gap-2 text-sm text-cream">
              <span className="rounded-lg bg-white/5 px-2 py-1 text-xs font-medium ring-1 ring-ink-line">{tableLabel(order.table)}</span>
              <span className="text-cream-dim">→</span>
              <span className="rounded-lg bg-gold/12 px-2 py-1 text-xs font-medium text-gold ring-1 ring-gold/30">
                {dest == null ? '—' : tableLabel(dest)}
              </span>
            </span>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-wider text-cream-dim">Move to</p>
            <div className="relative w-40 sm:w-48">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-cream-dim">
                <IconSearch size={14} />
              </span>
              <input
                className="input py-1.5 pl-8 text-sm"
                placeholder="Search table"
                value={query}
                onChange={(e) => onSearch(e.target.value)}
              />
            </div>
          </div>

          {options.length === 0 ? (
            <p className="mt-2 rounded-xl border border-ink-line bg-ink-soft/50 p-4 text-sm text-cream-dim">No other tables configured.</p>
          ) : filtered.length === 0 ? (
            <p className="mt-2 rounded-xl border border-ink-line bg-ink-soft/50 p-4 text-sm text-cream-dim">No tables match “{query}”.</p>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {shown.map((tbl) => {
                  const busy = occupied.has(tbl.id)
                  const selected = dest === tbl.id
                  return (
                    <button
                      key={tbl.id}
                      onClick={() => {
                        setDest(tbl.id)
                        setError('')
                      }}
                      title={busy ? 'This table already has a running order' : undefined}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-sm font-semibold transition ${
                        selected
                          ? 'border-gold/70 bg-gold/12 text-gold'
                          : busy
                            ? 'border-rose-500/40 bg-rose-500/[0.06] text-cream-dim hover:border-rose-500/60'
                            : 'border-ink-line bg-ink-soft text-cream hover:border-emerald-500/50'
                      }`}
                    >
                      <IconTable size={16} />
                      {tbl.number || `T${tbl.id}`}
                      {busy && <span className="text-[10px] font-normal text-rose-300">in use</span>}
                    </button>
                  )
                })}
              </div>

              {/* Prev · 1 … n · Next — hidden when everything fits on one page. */}
              {pageCount > 1 && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="rounded-lg border border-ink-line px-3 py-1.5 text-sm text-cream-dim transition hover:border-gold/40 hover:text-gold disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Prev
                  </button>
                  {pageWindow(safePage, pageCount).map((p, i) =>
                    p === '…' ? (
                      <span key={`gap-${i}`} className="px-1.5 text-sm text-cream-dim">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`min-w-[2rem] rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                          p === safePage
                            ? 'border-gold/60 bg-gold/12 text-gold'
                            : 'border-ink-line text-cream-dim hover:border-gold/40 hover:text-cream'
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={safePage === pageCount}
                    className="rounded-lg border border-ink-line px-3 py-1.5 text-sm text-cream-dim transition hover:border-gold/40 hover:text-gold disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}

          {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={dest == null}
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 py-3 font-semibold text-white transition-all duration-200 hover:from-emerald-400 hover:to-green-500 hover:shadow-lg hover:shadow-emerald-500/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
            >
              <IconCheck size={16} /> Move Order
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
