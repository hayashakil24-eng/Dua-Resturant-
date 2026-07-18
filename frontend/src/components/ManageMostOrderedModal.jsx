import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { money } from '../utils/format.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { IconClose, IconSearch, IconCheck } from './Icons.jsx'

// Curate the shared "Most Ordered" list. Toggling an item takes effect
// immediately and globally — every POS user sees the same list.
export default function ManageMostOrderedModal({ onClose }) {
  const { menu, mostOrderedItemIds, toggleMostOrdered } = useApp()
  const [query, setQuery] = useState('')
  useEscapeKey(onClose)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return menu
      .filter((m) => m.active !== false)
      .filter((m) => !q || m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q))
  }, [menu, query])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col animate-fade-up">
        <div className="card flex max-h-[85vh] flex-col p-0">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-ink-line p-5">
            <div>
              <h3 className="font-serif text-2xl text-cream">⭐ Manage Most Ordered</h3>
              <p className="mt-0.5 text-xs text-cream-dim">
                Pick your best sellers. Changes apply for everyone (Cashier, Admin, Manager).
              </p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          {/* Search */}
          <div className="border-b border-ink-line p-5">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cream-dim">
                <IconSearch size={18} />
              </span>
              <input
                className="input w-full rounded-xl py-2.5 pl-12 pr-4"
                placeholder="Search items…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Item list */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-2">
              {filtered.map((item) => {
                const isSelected = mostOrderedItemIds.includes(item.id)
                return (
                  <label
                    key={item.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                      isSelected
                        ? 'border-gold/50 bg-gold/[0.08]'
                        : 'border-ink-line bg-ink-soft hover:border-gold/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleMostOrdered(item.id)}
                      className="h-4 w-4 accent-gold"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-cream">{item.name}</p>
                      <p className="text-xs text-cream-dim">
                        {item.category} · {money(item.price)}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-gold">
                        <IconCheck size={14} /> Added
                      </span>
                    )}
                  </label>
                )
              })}
              {filtered.length === 0 && (
                <p className="py-10 text-center text-sm text-cream-dim">No items match your search.</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-ink-line p-5">
            <button onClick={onClose} className="btn-gold w-full py-3">
              Done · {mostOrderedItemIds.length} selected
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
