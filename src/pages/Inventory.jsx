import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, StatCard } from '../components/ui.jsx'
import { dateLong } from '../utils/format.js'
import { canModify } from '../config/permissions.js'
import {
  IconInventory,
  IconAlert,
  IconPlus,
  IconMinus,
  IconSearch,
} from '../components/Icons.jsx'

// Stock status helper — critical (<=50% of threshold), low (<=threshold), ok.
function stockLevel(item) {
  if (item.stock <= item.threshold * 0.5) return 'critical'
  if (item.stock <= item.threshold) return 'low'
  return 'ok'
}

const LEVEL_STYLES = {
  critical: 'bg-rose-500/12 text-rose-300 ring-rose-500/30',
  low: 'bg-amber-500/12 text-amber-300 ring-amber-500/30',
  ok: 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/30',
}

const LEVEL_LABEL = { critical: 'Critical', low: 'Low', ok: 'In stock' }

export default function Inventory() {
  const { inventory, lowStock, adjustStock, restock, user } = useApp()
  const [query, setQuery] = useState('')
  const canEdit = user && canModify(user.role, 'inventory')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = q
      ? inventory.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q),
        )
      : inventory
    // Surface the items that need attention first.
    const order = { critical: 0, low: 1, ok: 2 }
    return [...rows].sort((a, b) => order[stockLevel(a)] - order[stockLevel(b)])
  }, [inventory, query])

  const critical = inventory.filter((i) => stockLevel(i) === 'critical').length

  return (
    <div>
      <PageHeader title="Inventory" subtitle={dateLong()}>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream-dim">
            <IconSearch size={16} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items…"
            className="w-56 rounded-xl border border-ink-line bg-ink-soft py-2 pl-9 pr-3 text-sm text-cream placeholder:text-cream-dim/60 focus:border-gold/40 focus:outline-none"
          />
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={IconInventory} label="Total Items" value={inventory.length} sub="Tracked in kitchen" />
        <StatCard icon={IconAlert} label="Low Stock" value={lowStock.length} sub="At or below threshold" />
        <StatCard icon={IconAlert} label="Critical" value={critical} sub="Needs immediate restock" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-line text-xs uppercase tracking-wider text-cream-dim">
                <th className="px-5 py-4 font-semibold">Item</th>
                <th className="px-5 py-4 font-semibold">Category</th>
                <th className="px-5 py-4 font-semibold">In Stock</th>
                <th className="px-5 py-4 font-semibold">Threshold</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                {canEdit && <th className="px-5 py-4 text-right font-semibold">Adjust</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-line">
              {filtered.map((item) => {
                const level = stockLevel(item)
                const pct = Math.min(100, (item.stock / (item.threshold * 2)) * 100)
                return (
                  <tr key={item.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <p className="font-medium text-cream">{item.name}</p>
                      <p className="text-xs text-cream-dim">{item.id}</p>
                    </td>
                    <td className="px-5 py-4 text-cream-dim">{item.category}</td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-cream">
                        {item.stock} <span className="text-xs font-normal text-cream-dim">{item.unit}</span>
                      </p>
                      <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-ink-line">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            level === 'critical'
                              ? 'bg-rose-400'
                              : level === 'low'
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.max(6, pct)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-cream-dim">
                      {item.threshold} {item.unit}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`badge ring-1 ${LEVEL_STYLES[level]}`}>{LEVEL_LABEL[level]}</span>
                    </td>
                    {canEdit && (
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => adjustStock(item.id, -1)}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line bg-ink-soft text-cream-dim transition hover:border-rose-500/40 hover:text-rose-300"
                            title="Use 1 unit"
                          >
                            <IconMinus size={14} />
                          </button>
                          <button
                            onClick={() => adjustStock(item.id, 1)}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line bg-ink-soft text-cream-dim transition hover:border-emerald-500/40 hover:text-emerald-300"
                            title="Add 1 unit"
                          >
                            <IconPlus size={14} />
                          </button>
                          <button
                            onClick={() => restock(item.id, 10)}
                            className="btn-gold px-3 py-1.5 text-xs font-bold"
                          >
                            Restock +10
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-cream-dim">
            No items match “{query}”.
          </div>
        )}
      </div>
    </div>
  )
}
