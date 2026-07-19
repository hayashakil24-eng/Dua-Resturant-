import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { IconClose, IconPlus, IconTrash, IconAlert } from './Icons.jsx'

// Kitchen recipe builder: pick a menu item, then add ingredient rows drawn from
// live inventory. Each ingredient defaults to its inventory item's own unit, but
// the chef can pick a smaller measuring unit (tbsp/tsp/cup) from the same
// weight/volume family — deduction converts it back into the item's base unit
// (inventoryFlow.js's convertUnit) before subtracting stock, so e.g. "4 tbsp" of
// a masala stored in kg still deducts correctly.

// Measuring units a chef may pick per ingredient, grouped by the base unit its
// inventory item is stored in. Every option has a convertUnit() path into that
// base unit, so the deduction can always translate the chosen unit back to the
// item's own kg/L. Count-based items (pcs/packs) have no such conversion and
// stay locked to their own unit.
const MEASURE_UNITS = {
  weight: ['kg', 'g', 'tbsp', 'tsp', 'cup'],
  volume: ['L', 'ml', 'tbsp', 'tsp', 'cup'],
}
function unitsForInventory(inv) {
  const u = String(inv?.unit || '').toLowerCase()
  if (u === 'kg' || u === 'g') return MEASURE_UNITS.weight
  if (u === 'l' || u === 'ml') return MEASURE_UNITS.volume
  return inv?.unit ? [inv.unit] : []
}

export default function RecipeFormModal({ menu, inventory, existingRecipes = [], editingRecipe = null, onSave, onClose }) {
  const { ingredientRequests, createIngredientRequest } = useApp()
  const t = useT()
  const isEditing = !!editingRecipe
  // In edit mode, hydrate from the existing recipe; the dish itself is fixed
  // (you edit *its* recipe), so only the ingredient rows are mutable.
  const [menuItemId, setMenuItemId] = useState(editingRecipe?.menuItemId || '')
  const [ingredients, setIngredients] = useState(() =>
    (editingRecipe?.ingredients || []).map((ing, i) => ({
      id: ing.id || `${Date.now()}-${i}`,
      inventoryItemId: ing.inventoryItemId,
      itemName: ing.itemName,
      quantity: String(ing.quantity),
      unit: ing.unit,
    })),
  )
  const [error, setError] = useState('')
  useEscapeKey(onClose)

  // New Ingredient Request inline form states
  const [requestingIngIdx, setRequestingIngIdx] = useState(null)
  const [newIngName, setNewIngName] = useState('')
  const [newIngCategory, setNewIngCategory] = useState('')
  const [newIngUnit, setNewIngUnit] = useState('kg')
  const [reqError, setReqError] = useState('')

  const menuItems = menu.filter((m) => m.active !== false)

  // Menu items that already have an approved or pending recipe — flag to avoid
  // dupes. The recipe being edited is excluded so its own dish isn't flagged.
  const takenIds = new Set(
    existingRecipes
      .filter((r) => r.status !== 'rejected' && r.id !== editingRecipe?.id)
      .map((r) => r.menuItemId),
  )

  const addRow = () =>
    setIngredients((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length}`, inventoryItemId: '', itemName: '', quantity: '', unit: '' },
    ])

  const removeRow = (idx) => setIngredients((prev) => prev.filter((_, i) => i !== idx))

  const updateRowRequest = (idx, reqId, reqName, reqUnit) => {
    setIngredients((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row
        return { ...row, inventoryItemId: reqId, itemName: reqName, unit: reqUnit }
      }),
    )
  }

  const updateRow = (idx, field, val) =>
    setIngredients((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row
        if (field === 'inventoryItemId') {
          if (val === 'REQUEST_NEW_INGREDIENT') {
            setRequestingIngIdx(idx)
            return row
          }
          const inv = inventory.find((x) => x.id === val)
          if (inv) {
            return { ...row, inventoryItemId: val, itemName: inv.name, unit: inv.unit }
          }
          const req = ingredientRequests.find((x) => x.id === val)
          if (req) {
            return { ...row, inventoryItemId: val, itemName: req.name, unit: req.unit || 'kg' }
          }
          return { ...row, inventoryItemId: val, itemName: '', unit: '' }
        }
        return { ...row, [field]: val }
      }),
    )

  const save = () => {
    const menuItem = menuItems.find((m) => m.id === menuItemId)
    if (!menuItem) return setError(t('recipe.errSelectItem'))
    const clean = ingredients
      .filter((r) => r.inventoryItemId && Number(r.quantity) > 0)
      .map((r) => ({
        id: r.id,
        inventoryItemId: r.inventoryItemId,
        itemName: r.itemName,
        quantity: Number(r.quantity),
        unit: r.unit,
      }))
    if (clean.length === 0)
      return setError(t('recipe.errAddIngredient'))
    // Guard against two ingredient rows pointing at the same inventory item.
    const ids = clean.map((c) => c.inventoryItemId)
    if (new Set(ids).size !== ids.length)
      return setError(t('recipe.errDistinct'))
    setError('')
    onSave({ menuItemId, menuItemName: menuItem.name, ingredients: clean })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">{t('recipe.title')}</h3>
              <p className="mt-0.5 text-xs text-cream-dim">
                {t('recipe.subtitle')}
              </p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-xs uppercase tracking-widest text-cream-dim">
              {t('recipe.menuItem')}
            </label>
            <select
              value={menuItemId}
              onChange={(e) => setMenuItemId(e.target.value)}
              disabled={isEditing}
              className="input disabled:opacity-60"
            >
              <option value="">{t('recipe.selectMenuItem')}</option>
              {menuItems.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {takenIds.has(m.id) ? t('recipe.alreadyHasRecipe') : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs uppercase tracking-widest text-cream-dim">{t('recipe.ingredients')}</label>
              <button
                onClick={addRow}
                className="inline-flex items-center gap-1 rounded-lg border border-ink-line bg-ink-soft px-2.5 py-1 text-xs font-semibold text-cream-dim transition hover:text-cream"
              >
                <IconPlus size={13} /> {t('recipe.addIngredient')}
              </button>
            </div>

            {ingredients.length === 0 && (
              <p className="rounded-xl border border-dashed border-ink-line px-3 py-4 text-center text-xs text-cream-dim">
                {t('recipe.noIngredients')}
              </p>
            )}

            <div className="space-y-2">
              {ingredients.map((row, idx) => {
                const invItem = inventory.find((x) => x.id === row.inventoryItemId)
                const unitOpts = invItem ? unitsForInventory(invItem) : row.unit ? [row.unit] : []
                return (
                <div key={row.id} className="flex items-center gap-2">
                  <select
                    value={row.inventoryItemId}
                    onChange={(e) => updateRow(idx, 'inventoryItemId', e.target.value)}
                    className="input flex-1"
                  >
                    <option value="">{t('recipe.inventoryItem')}</option>
                    <option value="REQUEST_NEW_INGREDIENT" className="font-semibold text-gold">{t('recipe.requestNew')}</option>
                    {inventory.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name}
                      </option>
                    ))}
                    {ingredientRequests.filter((r) => r.status === 'pending').map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {t('recipe.pendingRequest')}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.quantity}
                    onChange={(e) => updateRow(idx, 'quantity', e.target.value)}
                    placeholder={t('recipe.qty')}
                    className="input w-20"
                  />
                  {/* Unit picker: defaults to the item's base unit but lets the chef
                      measure in tbsp/tsp/cup; deduction converts it back on order.
                      Locked (single option) for count-based items with no conversion. */}
                  <select
                    value={row.unit || ''}
                    onChange={(e) => updateRow(idx, 'unit', e.target.value)}
                    disabled={unitOpts.length <= 1}
                    title={t('recipe.unit')}
                    className="input w-20 shrink-0 px-2 disabled:opacity-60"
                  >
                    {unitOpts.length === 0 && <option value="">—</option>}
                    {unitOpts.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeRow(idx)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-line bg-ink-soft text-cream-dim transition hover:border-rose-500/40 hover:text-rose-300"
                    title={t('common.delete')}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
                )
              })}
            </div>
          </div>

          {error && (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              <IconAlert size={14} className="shrink-0" /> {error}
            </p>
          )}

          <p className="mt-4 flex items-center gap-2 rounded-xl border border-ink-line bg-ink-soft px-3 py-2 text-xs text-cream-dim">
            <IconAlert size={14} className="shrink-0 text-gold" />
            {t('recipe.needsApproval')}
          </p>

          <div className="mt-6 flex gap-3">
            <button onClick={save} className="btn-gold flex-1">
              {t('recipe.submitForApproval')}
            </button>
            <button onClick={onClose} className="btn-ghost flex-1">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>

      {requestingIngIdx !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRequestingIngIdx(null)} />
          <div className="relative z-10 w-full max-w-sm animate-fade-up">
            <div className="card p-6 border border-ink-line">
              <h4 className="font-serif text-xl text-cream font-semibold">{t('recipe.reqTitle')}</h4>
              <p className="text-xs text-cream-dim mt-0.5">{t('recipe.reqSubtitle')}</p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-cream-dim">{t('recipe.ingName')} *</label>
                  <input
                    type="text"
                    className="input py-2"
                    placeholder={t('recipe.ingNamePh')}
                    value={newIngName}
                    onChange={(e) => setNewIngName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-cream-dim">{t('recipe.categoryOptional')}</label>
                  <input
                    type="text"
                    className="input py-2"
                    placeholder={t('recipe.categoryPh')}
                    value={newIngCategory}
                    onChange={(e) => setNewIngCategory(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-cream-dim">{t('recipe.tempUnit')} *</label>
                  <select
                    className="input py-2"
                    value={newIngUnit}
                    onChange={(e) => setNewIngUnit(e.target.value)}
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="ml">ml</option>
                    <option value="tbsp">tbsp</option>
                    <option value="tsp">tsp</option>
                    <option value="pcs">pcs</option>
                    <option value="packs">packs</option>
                  </select>
                </div>
              </div>

              {reqError && (
                <p className="mt-3 text-xs text-rose-300 font-semibold">{reqError}</p>
              )}

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => {
                    if (!newIngName.trim()) {
                      return setReqError(t('recipe.errNameReq'))
                    }
                    const res = createIngredientRequest({
                      name: newIngName.trim(),
                      category: newIngCategory.trim() || 'Other',
                    })
                    if (res && res.error) {
                      return setReqError(res.error)
                    }

                    // Update the row with the pending request details
                    updateRowRequest(requestingIngIdx, res.id, res.name, newIngUnit)

                    // Reset
                    setNewIngName('')
                    setNewIngCategory('')
                    setNewIngUnit('kg')
                    setReqError('')
                    setRequestingIngIdx(null)
                  }}
                  className="btn-gold flex-1 py-2 text-sm"
                >
                  {t('recipe.submitRequest')}
                </button>
                <button
                  onClick={() => {
                    setRequestingIngIdx(null)
                    setReqError('')
                  }}
                  className="btn-ghost flex-1 py-2 text-sm"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
