import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT, useLang } from '../i18n/LanguageContext.jsx'
import { PageHeader, StatCard } from '../components/ui.jsx'
import { dateLong, money } from '../utils/format.js'
import { unitLabel, categoryLabel, itemNameLabel } from '../i18n/dataDict.js'
import { canModify } from '../config/permissions.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import SettlePayableModal from '../components/SettlePayableModal.jsx'
import {
  IconInventory,
  IconAlert,
  IconPlus,
  IconSearch,
  IconClose,
  IconCheck,
  IconWallet,
} from '../components/Icons.jsx'

// Base units an inventory item can be tracked in.
const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'packs']
// Sentinel for the "New category…" option in the add-item dropdown (mirrors
// MenuManagement's MenuItemModal so Inventory can introduce a fresh category).
const NEW_CAT = '__new__'

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

// Local day string — never toISOString(), which converts to UTC first and would
// date a purchase entered after midnight (Pakistan, UTC+5) as "yesterday",
// putting it on the wrong day's report. Same reasoning as Accounting.jsx.
const toDayStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Recording a stock purchase: quantity bought, what it cost, and when. This is
// the only inventory path that books money — the +/- buttons are corrections to
// a miscount, where nothing was actually bought.
function PurchaseModal({ item, unitName, onClose, onSave }) {
  const t = useT()
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState(String(item.costPerUnit || ''))
  const [totalCost, setTotalCost] = useState('')
  const [supplier, setSupplier] = useState('')
  const [date, setDate] = useState(() => toDayStr(new Date()))
  // Paid now (books an expense immediately, the original behavior) vs. on
  // credit ("udhar" — supplier goes unpaid until settled later, see
  // recordPayablePayment). Supplier is required for credit — that's the
  // whole point of tracking it.
  const [paid, setPaid] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEscapeKey(onClose)

  const qtyNum = Number(quantity) || 0
  const derivedTotal = Math.round(qtyNum * (Number(unitCost) || 0))
  // A real bill rarely equals qty × rate exactly (rounding, delivery), so an
  // explicit total overrides the derived one.
  const effectiveTotal = Number(totalCost) > 0 ? Math.round(Number(totalCost)) : derivedTotal
  const valid = qtyNum > 0 && effectiveTotal > 0 && (paid || supplier.trim().length > 0)

  const submit = async () => {
    setSaving(true)
    const res = await onSave({
      quantity: qtyNum,
      unitCost: Number(unitCost) || 0,
      totalCost: Number(totalCost) > 0 ? Number(totalCost) : undefined,
      supplier: supplier.trim(),
      date: `${date}T00:00:00`,
      paid,
    })
    setSaving(false)
    if (res?.error) return setError(res.error)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">{t('inventory.buyStock')}</h3>
              <p className="mt-0.5 text-xs text-cream-dim">{item.name}</p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  {t('inventory.purchaseQty')} ({unitName})
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  className="input"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  {t('inventory.purchaseUnitCost')}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="input"
                  placeholder="0"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  {t('inventory.purchaseTotal')}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="input"
                  placeholder={derivedTotal ? String(derivedTotal) : '0'}
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  {t('inventory.purchaseDate')}
                </label>
                <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('inventory.purchaseSupplier')}
                {!paid && <span className="text-rose-300"> *</span>}
              </label>
              <input
                className="input"
                placeholder={t('inventory.purchaseSupplierPh')}
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('inventory.purchasePayment')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaid(true)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                    paid ? 'border-gold/50 bg-gold/12 text-gold' : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                  }`}
                >
                  {t('inventory.paymentPaidNow')}
                </button>
                <button
                  type="button"
                  onClick={() => setPaid(false)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                    !paid ? 'border-amber-500/50 bg-amber-500/12 text-amber-300' : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                  }`}
                >
                  {t('inventory.paymentCredit')}
                </button>
              </div>
            </div>
          </div>

          {effectiveTotal > 0 && (
            <p
              className={`mt-4 rounded-xl border px-4 py-2.5 text-sm ${
                paid ? 'border-rose-500/25 bg-rose-500/[0.06] text-rose-300' : 'border-amber-500/25 bg-amber-500/[0.06] text-amber-300'
              }`}
            >
              {paid ? t('inventory.purchaseWillBook') : t('inventory.purchaseWillOwe')} <strong>{money(effectiveTotal)}</strong>
              {!paid && supplier.trim() && ` — ${supplier.trim()}`}
            </p>
          )}
          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              {t('common.cancel')}
            </button>
            <button
              onClick={submit}
              disabled={!valid || saving}
              className="btn-gold flex-1 py-3 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconCheck size={18} /> {t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Admin-only form to create a brand-new inventory item directly (separate from
// the Chef's ingredient-request flow). `categories` seeds the dropdown from the
// existing inventory; `onSave` runs the context action and returns {error?}.
function AddItemModal({ categories, onClose, onSave }) {
  const t = useT()
  const [name, setName] = useState('')
  const [nameUr, setNameUr] = useState('')
  // Default to the "new category" input when the inventory has no categories yet.
  const [category, setCategory] = useState(categories[0] || NEW_CAT)
  const [newCat, setNewCat] = useState('')
  const [unit, setUnit] = useState(UNITS[0])
  const [stock, setStock] = useState('0')
  const [threshold, setThreshold] = useState('0')
  const [costPerUnit, setCostPerUnit] = useState('0')
  const [error, setError] = useState('')
  useEscapeKey(onClose)

  // Categories are derived from existing items, so a brand-new one is just a
  // string typed here — it appears in the dropdown once this item is saved.
  const resolvedCategory = category === NEW_CAT ? newCat.trim() : category
  const valid = name.trim().length > 0 && resolvedCategory.length > 0

  const submit = async () => {
    const res = await onSave({
      name: name.trim(),
      nameUr: nameUr.trim(),
      category: resolvedCategory,
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
        <div className="card max-h-[90vh] overflow-y-auto p-6">
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
                  <option value={NEW_CAT}>{t('inventory.newCategoryOpt')}</option>
                </select>
                {category === NEW_CAT && (
                  <input
                    className="input mt-2 py-2"
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    placeholder={t('inventory.newCategoryPh')}
                  />
                )}
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

const INVENTORY_PAGE_SIZE = 20

export default function Inventory() {
  const { inventory, lowStock, recordPurchase, addInventoryItem, user, payables, recordPayablePayment, canSettlePayables } = useApp()
  const { t, lang } = useLang()
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [visibleCount, setVisibleCount] = useState(INVENTORY_PAGE_SIZE)
  const [buying, setBuying] = useState(null) // inventory item being purchased
  const [settlingPayable, setSettlingPayable] = useState(null) // supplier account being paid down
  const openPayables = useMemo(() => payables.filter((p) => p.status !== 'settled'), [payables])
  const totalOwed = useMemo(() => openPayables.reduce((s, p) => s + p.balance, 0), [openPayables])
  // Page access (also gates whether the Adjust column shows at all).
  const canEdit = user && canModify(user.role, 'inventory')
  // Stock only ever moves through a recorded purchase (Buy Stock) or a
  // recipe deduction — the old one-click +/- adjust buttons were removed
  // because they changed quantities with no cost, supplier or reason attached.
  const canAddStock = user && canModify(user.role, 'inventoryAdd')
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
    // Newest items first, so a freshly added item appears at the top of the list.
    return [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [inventory, query])

  const critical = inventory.filter((i) => stockLevel(i) === 'critical').length
  const shown = filtered.slice(0, visibleCount)

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
              onChange={(e) => {
                setQuery(e.target.value)
                setVisibleCount(INVENTORY_PAGE_SIZE)
              }}
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
                {canAddStock && <th className="px-5 py-4 text-right font-semibold">{t('inventory.colAdjust')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-line">
              {shown.map((item) => {
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
                    {canAddStock && (
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setBuying(item)}
                            className="btn-gold px-3 py-1.5 text-xs font-bold"
                            title={t('inventory.addNewStock')}
                          >
                            {t('inventory.buyStock')}
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
            {t('inventory.noMatch')} “{query}”.
          </div>
        )}
        {shown.length < filtered.length && (
          <div className="flex items-center justify-center border-t border-ink-line p-4">
            <button
              onClick={() => setVisibleCount((c) => c + INVENTORY_PAGE_SIZE)}
              className="btn-ghost px-5 py-2 text-sm"
            >
              {t('inventory.loadMore', 'Load more')} · {shown.length}/{filtered.length}
            </button>
          </div>
        )}
      </div>

      {/* Supplier credit ("udhar") purchases — only shown to whoever can also
          record a purchase, since this is that same money owed as a
          consequence. Mirrors ReceivablesManagement's layout, flipped. */}
      {canAddStock && openPayables.length > 0 && (
        <div className="card mt-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-line p-5">
            <div>
              <h3 className="font-serif text-xl text-cream">{t('payables.title')}</h3>
              <p className="text-xs text-cream-dim">{t('payables.subtitle')}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-widest text-cream-dim">{t('payables.totalOwed')}</p>
              <p className="font-serif text-xl font-semibold text-rose-300">{money(totalOwed)}</p>
            </div>
          </div>
          <div className="divide-y divide-ink-line">
            {openPayables.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-cream">{p.name}</p>
                  <p className="text-xs text-cream-dim">
                    {p.purchases?.length || 0} {t('payables.purchaseCount')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-serif text-lg font-semibold text-rose-300">{money(p.balance)}</span>
                  {canSettlePayables() && (
                    <button
                      onClick={() => setSettlingPayable(p)}
                      className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20"
                    >
                      <IconWallet size={14} className="inline -mt-0.5 mr-1" /> {t('payables.settle')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <AddItemModal
          categories={categories}
          onClose={() => setShowAdd(false)}
          onSave={addInventoryItem}
        />
      )}

      {buying && (
        <PurchaseModal
          item={buying}
          unitName={unitLabel(buying.unit, lang)}
          onClose={() => setBuying(null)}
          onSave={(payload) => recordPurchase(buying.id, payload)}
        />
      )}

      {settlingPayable && (
        <SettlePayableModal
          payable={settlingPayable}
          onClose={() => setSettlingPayable(null)}
          onConfirm={async (data) => {
            const res = await recordPayablePayment(settlingPayable.id, data.amount, data)
            if (res?.error) return
            setSettlingPayable(null)
          }}
        />
      )}
    </div>
  )
}
