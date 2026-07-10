import { useState } from 'react'
import { IconClose, IconPlus, IconTrash, IconAlert } from './Icons.jsx'

// Kitchen recipe builder: pick a menu item, then add ingredient rows drawn from
// live inventory. Each ingredient's unit is taken from the chosen inventory item
// (deduction subtracts from that item's `stock` in its own unit), so we show the
// unit as a fixed label rather than letting it be mis-picked.
export default function RecipeFormModal({ menu, inventory, existingRecipes = [], onSave, onClose }) {
  const [menuItemId, setMenuItemId] = useState('')
  const [ingredients, setIngredients] = useState([])
  const [error, setError] = useState('')

  const menuItems = menu.filter((m) => m.active !== false)

  // Menu items that already have an approved or pending recipe — flag to avoid dupes.
  const takenIds = new Set(
    existingRecipes.filter((r) => r.status !== 'rejected').map((r) => r.menuItemId),
  )

  const addRow = () =>
    setIngredients((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length}`, inventoryItemId: '', itemName: '', quantity: '', unit: '' },
    ])

  const removeRow = (idx) => setIngredients((prev) => prev.filter((_, i) => i !== idx))

  const updateRow = (idx, field, val) =>
    setIngredients((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row
        if (field === 'inventoryItemId') {
          const inv = inventory.find((x) => x.id === val)
          return { ...row, inventoryItemId: val, itemName: inv?.name || '', unit: inv?.unit || '' }
        }
        return { ...row, [field]: val }
      }),
    )

  const save = () => {
    const menuItem = menuItems.find((m) => m.id === menuItemId)
    if (!menuItem) return setError('Select a menu item.')
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
      return setError('Add at least one ingredient with a quantity greater than zero.')
    // Guard against two ingredient rows pointing at the same inventory item.
    const ids = clean.map((c) => c.inventoryItemId)
    if (new Set(ids).size !== ids.length)
      return setError('Each ingredient must be a different inventory item.')
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
              <h3 className="font-serif text-2xl text-cream">Create Recipe</h3>
              <p className="mt-0.5 text-xs text-cream-dim">
                Submitted for Admin approval before it affects inventory.
              </p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-xs uppercase tracking-widest text-cream-dim">
              Menu item
            </label>
            <select
              value={menuItemId}
              onChange={(e) => setMenuItemId(e.target.value)}
              className="input"
            >
              <option value="">Select menu item…</option>
              {menuItems.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {takenIds.has(m.id) ? ' — already has a recipe' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs uppercase tracking-widest text-cream-dim">Ingredients</label>
              <button
                onClick={addRow}
                className="inline-flex items-center gap-1 rounded-lg border border-ink-line bg-ink-soft px-2.5 py-1 text-xs font-semibold text-cream-dim transition hover:text-cream"
              >
                <IconPlus size={13} /> Add ingredient
              </button>
            </div>

            {ingredients.length === 0 && (
              <p className="rounded-xl border border-dashed border-ink-line px-3 py-4 text-center text-xs text-cream-dim">
                No ingredients yet — add at least one.
              </p>
            )}

            <div className="space-y-2">
              {ingredients.map((row, idx) => (
                <div key={row.id} className="flex items-center gap-2">
                  <select
                    value={row.inventoryItemId}
                    onChange={(e) => updateRow(idx, 'inventoryItemId', e.target.value)}
                    className="input flex-1"
                  >
                    <option value="">Inventory item…</option>
                    {inventory.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.quantity}
                    onChange={(e) => updateRow(idx, 'quantity', e.target.value)}
                    placeholder="Qty"
                    className="input w-20"
                  />
                  <span className="w-10 shrink-0 text-center text-xs text-cream-dim">
                    {row.unit || '—'}
                  </span>
                  <button
                    onClick={() => removeRow(idx)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-line bg-ink-soft text-cream-dim transition hover:border-rose-500/40 hover:text-rose-300"
                    title="Remove"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              <IconAlert size={14} className="shrink-0" /> {error}
            </p>
          )}

          <p className="mt-4 flex items-center gap-2 rounded-xl border border-ink-line bg-ink-soft px-3 py-2 text-xs text-cream-dim">
            <IconAlert size={14} className="shrink-0 text-gold" />
            This recipe needs Admin approval before it affects inventory deduction.
          </p>

          <div className="mt-6 flex gap-3">
            <button onClick={save} className="btn-gold flex-1">
              Submit for Approval
            </button>
            <button onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
