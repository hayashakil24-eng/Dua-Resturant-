import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT, useLang } from '../i18n/LanguageContext.jsx'
import { PageHeader, StatCard } from '../components/ui.jsx'
import { dateLong, money } from '../utils/format.js'
import { unitLabel, categoryLabel, itemNameLabel } from '../i18n/dataDict.js'
import { canModify } from '../config/permissions.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import {
  IconInventory,
  IconAlert,
  IconPlus,
  IconMinus,
  IconSearch,
  IconClose,
  IconCheck,
} from '../components/Icons.jsx'

// Base units an inventory item can be tracked in.
const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'packs']

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

const LEVEL_LABEL_KEY = { critical: 'inventory.levelCritical', low: 'inventory.levelLow', ok: 'inventory.levelOk' }

// Admin-only form to create a brand-new inventory item directly (separate from
// the Chef's ingredient-request flow). `categories` seeds the dropdown from the
// existing inventory; `onSave` runs the context action and returns {error?}.
function AddItemModal({ categories, onClose, onSave }) {
  const t = useT()
  const [name, setName] = useState('')
  const [nameUr, setNameUr] = useState('')
  const [category, setCategory] = useState(categories[0] || 'Other')
  const [unit, setUnit] = useState(UNITS[0])
  const [stock, setStock] = useState('0')
  const [threshold, setThreshold] = useState('0')
  const [costPerUnit, setCostPerUnit] = useState('0')
  const [error, setError] = useState('')
  useEscapeKey(onClose)

  const valid = name.trim().length > 0

  const submit = async () => {
    const res = await onSave({
      name: name.trim(),
      nameUr: nameUr.trim(),
      category,
      unit,
      stock: Number(stock) || 0,
      threshold: Number(threshold) || 0,
      costPerUnit: Number(costPerUnit) || 0,
    })
    if (res?.error) {
      setError(res.error)
      return
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">{t('inventory.addNewItem')}</h3>
              <p className="mt-0.5 text-xs text-cream-dim">{t('inventory.createDirectly')}</p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('inventory.itemName')}
              </label>
              <input
                className="input"
                placeholder={t('inventory.itemNamePh')}
                value={name}
                autoFocus
                onChange={(e) => {
                  setName(e.target.value)
                  if (error) setError('')
                }}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('inventory.itemNameUr')}
              </label>
              <input
                className="input"
                dir="rtl"
                placeholder={t('inventory.itemNameUrPh')}
                value={nameUr}
                onChange={(e) => setNameUr(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  {t('inventory.category')}
                </label>
                <select
                  className="input py-2"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  {t('inventory.baseUnit')}
                </label>
                <select className="input py-2" value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  {t('inventory.initialStock')}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="input"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  {t('inventory.thresholdAlert')}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="input"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('inventory.costPerUnit')} ({unit})
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                className="input"
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
          )}

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              {t('common.cancel')}
            </button>
            <button
              onClick={submit}
              disabled={!valid}
              className="btn-gold flex-1 py-3 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconCheck size={18} /> {t('inventory.addItem')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Inventory() {
  const { inventory, lowStock, adjustStock, restock, addInventoryItem, user } = useApp()
  const { t, lang } = useLang()
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  // Page access (also gates whether the Adjust column shows at all).
  const canEdit = user && canModify(user.role, 'inventory')
  // Separation of duties: only Manager adds new stock; Admin & Manager may
  // adjust existing quantities for corrections.
  const canAddStock = user && canModify(user.role, 'inventoryAdd')
  const canAdjust = user && canModify(user.role, 'inventoryDirectEdit')
  // Admin & Manager may create a brand-new inventory item directly.
  const canCreate = user && canModify(user.role, 'inventoryCreate')

  // Existing categories seed the "Add Item" dropdown (canonical order preserved).
  const categories = useMemo(
    () => [...new Set(inventory.map((i) => i.category))].sort(),
    [inventory],
  )

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
      <PageHeader title={t('inventory.title')} subtitle={dateLong()}>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-cream-dim">
              <IconSearch size={16} />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('inventory.searchItems')}
              className="w-56 rounded-xl border border-ink-line bg-ink-soft py-2 ps-9 pe-3 text-sm text-cream placeholder:text-cream-dim focus:border-gold/40 focus:outline-none"
            />
          </div>
          {canCreate && (
            <button onClick={() => setShowAdd(true)} className="btn-gold shrink-0 px-4 py-2 text-sm">
              <IconPlus size={16} /> {t('inventory.addNewItem')}
            </button>
          )}
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={IconInventory} label={t('inventory.totalItems')} value={inventory.length} sub={t('inventory.trackedInKitchen')} />
        <StatCard icon={IconAlert} label={t('inventory.lowStock')} value={lowStock.length} sub={t('inventory.atOrBelow')} />
        <StatCard icon={IconAlert} label={t('inventory.critical')} value={critical} sub={t('inventory.needsRestock')} />
      </div>

      {canEdit && !canAddStock && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-ink-line bg-ink-soft px-4 py-2.5 text-xs text-cream-dim">
          <IconAlert size={14} className="shrink-0 text-gold" />
          {t('inventory.managerNote')}
        </p>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-line text-xs uppercase tracking-wider text-cream-dim">
                <th className="px-5 py-4 font-semibold">{t('inventory.colItem')}</th>
                <th className="px-5 py-4 font-semibold">{t('inventory.colCategory')}</th>
                <th className="px-5 py-4 font-semibold">{t('inventory.colInStock')}</th>
                <th className="px-5 py-4 font-semibold">{t('inventory.colThreshold')}</th>
                <th className="px-5 py-4 text-right font-semibold">{t('inventory.colCost')}</th>
                <th className="px-5 py-4 font-semibold">{t('inventory.colStatus')}</th>
                {canEdit && <th className="px-5 py-4 text-right font-semibold">{t('inventory.colAdjust')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-line">
              {filtered.map((item) => {
                const level = stockLevel(item)
                const pct = Math.min(100, (item.stock / (item.threshold * 2)) * 100)
                return (
                  <tr key={item.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <p className="font-medium text-cream">
                        {lang === 'ur' && item.nameUr ? item.nameUr : itemNameLabel(item.name, lang)}
                      </p>
                      <p className="text-xs text-cream-dim">{item.id}</p>
                    </td>
                    <td className="px-5 py-4 text-cream-dim">{categoryLabel(item.category, lang)}</td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-cream">
                        {item.stock} <span className="text-xs font-normal text-cream-dim">{unitLabel(item.unit, lang)}</span>
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
                      {item.threshold} {unitLabel(item.unit, lang)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {item.costPerUnit > 0 ? (
                        <span className="text-cream">
                          {money(item.costPerUnit)}
                          <span className="text-xs text-cream-dim">/{unitLabel(item.unit, lang)}</span>
                        </span>
                      ) : (
                        <span className="text-cream-dim">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`badge ring-1 ${LEVEL_STYLES[level]}`}>{t(LEVEL_LABEL_KEY[level])}</span>
                    </td>
                    {canEdit && (
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {canAdjust && (
                            <>
                              <button
                                onClick={() => adjustStock(item.id, -1)}
                                className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line bg-ink-soft text-cream-dim transition hover:border-rose-500/40 hover:text-rose-300"
                                title={t('inventory.useOne')}
                              >
                                <IconMinus size={14} />
                              </button>
                              <button
                                onClick={() => adjustStock(item.id, 1)}
                                className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line bg-ink-soft text-cream-dim transition hover:border-emerald-500/40 hover:text-emerald-300"
                                title={t('inventory.addOne')}
                              >
                                <IconPlus size={14} />
                              </button>
                            </>
                          )}
                          {canAddStock && (
                            <button
                              onClick={() => restock(item.id, 10)}
                              className="btn-gold px-3 py-1.5 text-xs font-bold"
                              title={t('inventory.addNewStock')}
                            >
                              {t('inventory.restock10')}
                            </button>
                          )}
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
            {t('inventory.noMatch')} “{query}”.
          </div>
        )}
      </div>

      {showAdd && (
        <AddItemModal
          categories={categories}
          onClose={() => setShowAdd(false)}
          onSave={addInventoryItem}
        />
      )}
    </div>
  )
}
