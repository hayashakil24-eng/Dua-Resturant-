import { useMemo, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, StatCard } from '../components/ui.jsx'
import { canModify } from '../config/permissions.js'
import { money } from '../utils/format.js'
import { MENU_CATEGORIES } from '../data/mockData.js'
import {
  IconMenuBook,
  IconSearch,
  IconPlus,
  IconMinus,
  IconTrash,
  IconEdit,
  IconClose,
  IconCheck,
} from '../components/Icons.jsx'

const priceLabel = (item) => {
  if (item.variants && item.variants.length) {
    const prices = item.variants.map((v) => v.price)
    const lo = Math.min(...prices)
    const hi = Math.max(...prices)
    return lo === hi ? money(lo) : `${money(lo)} – ${money(hi)}`
  }
  return money(item.price)
}

const NEW_CAT = '__new__'

// ---------------------------------------------------------------------------
function ItemModal({ item, categories, onSave, onClose }) {
  const editing = !!item
  const [name, setName] = useState(item?.name || '')
  const [existingCat] = useState(item?.category || categories[0] || '')
  const [category, setCategory] = useState(
    item && !categories.includes(item.category) ? NEW_CAT : existingCat,
  )
  const [newCat, setNewCat] = useState(
    item && !categories.includes(item.category) ? item.category : '',
  )
  const [description, setDescription] = useState(item?.description || '')
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : '')
  const [hasVariants, setHasVariants] = useState(!!(item?.variants && item.variants.length))
  const [variants, setVariants] = useState(
    item?.variants?.length ? item.variants.map((v) => ({ ...v })) : [{ label: '', price: '' }],
  )
  const [active, setActive] = useState(item ? item.active !== false : true)
  const [image, setImage] = useState(item?.image || null) // data URL or existing path
  const [imageError, setImageError] = useState('')

  // Read the chosen file into a data URL so it persists in menu state without a
  // backend. Image-only, capped at 2MB.
  const onImageChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file after a remove
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setImageError('Please choose an image file.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setImageError('Image must be under 2MB.')
      return
    }
    setImageError('')
    const reader = new FileReader()
    reader.onloadend = () => setImage(reader.result)
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImage(null)
    setImageError('')
  }

  const resolvedCategory = category === NEW_CAT ? newCat.trim() : category

  const cleanVariants = variants
    .map((v) => ({ label: v.label.trim(), price: Number(v.price) }))
    .filter((v) => v.label && v.price > 0)

  const valid =
    name.trim() &&
    resolvedCategory &&
    (hasVariants ? cleanVariants.length >= 1 : Number(price) > 0)

  const setVariant = (i, field, val) =>
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, [field]: val } : v)))
  const addVariant = () => setVariants((vs) => [...vs, { label: '', price: '' }])
  const removeVariant = (i) => setVariants((vs) => vs.filter((_, idx) => idx !== i))

  const save = () => {
    if (!valid) return
    const payload = {
      name: name.trim(),
      category: resolvedCategory,
      description: description.trim() || undefined,
      image: image || undefined,
      active,
    }
    if (hasVariants) {
      payload.variants = cleanVariants
      payload.price = Math.min(...cleanVariants.map((v) => v.price))
    } else {
      payload.price = Number(price)
      payload.variants = undefined
    }
    onSave(payload)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <h3 className="font-serif text-2xl text-cream">{editing ? 'Edit Item' : 'Add Item'}</h3>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                Item name
              </label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken Tikka Pizza" />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                Category
              </label>
              <select className="input py-2.5" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={NEW_CAT}>+ New category…</option>
              </select>
              {category === NEW_CAT && (
                <input
                  className="input mt-2"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  placeholder="New category name"
                />
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                Description (optional)
              </label>
              <textarea
                className="input min-h-[64px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description…"
              />
            </div>

            {/* Image (optional) */}
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                Item image (optional)
              </label>
              {image ? (
                <div className="flex items-center gap-4">
                  <img
                    src={image}
                    alt="preview"
                    className="h-20 w-20 shrink-0 rounded-xl border border-gold/30 object-cover"
                  />
                  <div className="flex flex-col gap-2">
                    <label className="btn-ghost cursor-pointer px-3 py-1.5 text-sm">
                      Change image
                      <input type="file" accept="image/*" onChange={onImageChange} className="hidden" />
                    </label>
                    <button
                      onClick={removeImage}
                      className="text-xs text-rose-300 hover:text-rose-200"
                    >
                      Remove image
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-line p-5 text-sm text-cream-dim transition hover:border-gold/50 hover:text-cream">
                  📷 Click to upload an image
                  <input type="file" accept="image/*" onChange={onImageChange} className="hidden" />
                </label>
              )}
              {imageError ? (
                <p className="mt-1.5 text-xs text-rose-300">{imageError}</p>
              ) : (
                <p className="mt-1.5 text-xs text-cream-dim/60">
                  No image? A themed placeholder is shown on the POS.
                </p>
              )}
            </div>

            {/* Variants toggle */}
            <label className="flex items-center gap-2.5 text-sm text-cream">
              <input
                type="checkbox"
                checked={hasVariants}
                onChange={(e) => setHasVariants(e.target.checked)}
                className="h-4 w-4 accent-gold"
              />
              This item has options (sizes / types)
            </label>

            {hasVariants ? (
              <div className="space-y-2 rounded-xl border border-ink-line bg-ink-soft/50 p-3">
                {variants.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="input py-2"
                      placeholder="Label (e.g. Large)"
                      value={v.label}
                      onChange={(e) => setVariant(i, 'label', e.target.value)}
                    />
                    <input
                      type="number"
                      min={0}
                      className="input w-32 py-2"
                      placeholder="Price"
                      value={v.price}
                      onChange={(e) => setVariant(i, 'price', e.target.value)}
                    />
                    <button
                      onClick={() => removeVariant(i)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-line text-cream-dim hover:text-rose-300"
                    >
                      <IconMinus size={16} />
                    </button>
                  </div>
                ))}
                <button onClick={addVariant} className="btn-ghost w-full py-2 text-sm">
                  <IconPlus size={16} /> Add option
                </button>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  Price (Rs.)
                </label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}

            <label className="flex items-center gap-2.5 text-sm text-cream">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-gold"
              />
              Available (shown on POS)
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!valid}
              className="btn-gold flex-1 py-3 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconCheck size={18} /> {editing ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
export default function MenuManagement() {
  const {
    menu,
    menuCategories,
    addCategory,
    deleteCategory,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleMenuItem,
    replaceMenu,
    user,
  } = useApp()

  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [modalItem, setModalItem] = useState(undefined) // undefined=closed, null=add, obj=edit
  const [notice, setNotice] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(null)
  const fileRef = useRef(null)

  const canAddCategory = user && canModify(user.role, 'categoryAdd')

  // Item count per category (case-insensitive), for the chip badges + delete guard.
  const categoryCounts = useMemo(() => {
    const counts = {}
    menu.forEach((m) => {
      const k = m.category.toLowerCase()
      counts[k] = (counts[k] || 0) + 1
    })
    return counts
  }, [menu])

  const submitCategory = () => {
    setCategoryError('')
    const result = addCategory(newCategory)
    if (result?.error) return setCategoryError(result.error)
    flash(`Category “${newCategory.trim()}” added.`)
    setNewCategory('')
  }

  // Non-empty → block immediately with the counted error. Empty → confirm first.
  const requestDeleteCategory = (cat) => {
    setCategoryError('')
    if ((categoryCounts[cat.toLowerCase()] || 0) > 0) {
      const result = deleteCategory(cat)
      if (result?.error) setCategoryError(result.error)
      return
    }
    setConfirmingDelete(cat)
  }

  const confirmDeleteCategory = () => {
    const result = deleteCategory(confirmingDelete)
    if (result?.error) setCategoryError(result.error)
    else flash(`Category “${confirmingDelete}” deleted.`)
    setConfirmingDelete(null)
  }

  const catOrder = (c) => {
    const i = MENU_CATEGORIES.indexOf(c)
    return i === -1 ? 999 : i
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return menu
      .filter(
        (m) =>
          (catFilter === 'All' || m.category === catFilter) &&
          (!q || m.name.toLowerCase().includes(q)),
      )
      .sort((a, b) => catOrder(a.category) - catOrder(b.category) || a.name.localeCompare(b.name))
  }, [menu, query, catFilter])

  const activeCount = menu.filter((m) => m.active !== false).length

  const flash = (msg) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 3500)
  }

  const exportMenu = () => {
    const blob = new Blob([JSON.stringify(menu, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cafe-ali-menu.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importMenu = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        const items = Array.isArray(data) ? data : data.items
        if (!Array.isArray(items) || !items.length) throw new Error('empty')
        replaceMenu(items)
        flash(`Imported ${items.length} items.`)
      } catch {
        flash('Invalid menu file.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const onSave = (payload) => {
    if (modalItem) updateMenuItem(modalItem.id, payload)
    else addMenuItem(payload)
  }

  return (
    <div>
      <PageHeader title="Menu Management" subtitle="Add, edit and price items — changes sync to the POS instantly.">
        <div className="flex flex-wrap gap-2">
          <button onClick={exportMenu} className="btn-ghost px-4 py-2 text-sm">
            Export
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn-ghost px-4 py-2 text-sm">
            Import
          </button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importMenu} />
          <button onClick={() => setModalItem(null)} className="btn-gold px-4 py-2 text-sm">
            <IconPlus size={16} /> Add Item
          </button>
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={IconMenuBook} label="Total Items" value={menu.length} sub="On the menu" />
        <StatCard icon={IconCheck} label="Available" value={activeCount} sub="Shown on POS" />
        <StatCard icon={IconMenuBook} label="Categories" value={menuCategories.length} sub="In use" />
      </div>

      {notice && (
        <div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2.5 text-sm text-gold">
          {notice}
        </div>
      )}

      {/* Add category — free text, Admin/Manager only. No fixed/predefined list. */}
      {canAddCategory && (
        <div className="card mb-5 p-4">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-cream-dim">Add category</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="input flex-1"
              placeholder="Type any category name… e.g. Weekend Specials"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitCategory()}
            />
            <button onClick={submitCategory} className="btn-gold px-4 py-2 text-sm sm:w-auto">
              <IconPlus size={16} /> Add Category
            </button>
          </div>
          {categoryError && (
            <p className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              ❌ {categoryError}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {menuCategories.map((c) => {
              const count = categoryCounts[c.toLowerCase()] || 0
              const empty = count === 0
              return (
                <span
                  key={c}
                  className="badge bg-gold/10 text-gold ring-1 ring-gold/25"
                >
                  {c}
                  <span className="text-[10px] text-gold/60">({count})</span>
                  <button
                    onClick={() => requestDeleteCategory(c)}
                    title={
                      empty
                        ? `Delete “${c}”`
                        : `Cannot delete — ${count} item${count > 1 ? 's' : ''} in use`
                    }
                    className={`ml-0.5 transition ${
                      empty ? 'hover:text-rose-300' : 'text-gold/40 hover:text-rose-300'
                    }`}
                  >
                    <IconClose size={12} />
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cream-dim">
            <IconSearch size={18} />
          </span>
          <input
            className="input pl-11"
            placeholder="Search items…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="input sm:w-56"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="All">All Categories</option>
          {menuCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="max-h-[calc(100vh-24rem)] overflow-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-ink-card">
              <tr className="border-b border-ink-line text-xs uppercase tracking-wider text-cream-dim">
                <th className="px-5 py-3 font-semibold">Item</th>
                <th className="px-5 py-3 font-semibold">Category</th>
                <th className="px-5 py-3 text-right font-semibold">Price</th>
                <th className="px-5 py-3 text-center font-semibold">Available</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-line">
              {filtered.map((m) => (
                <tr key={m.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {m.image ? (
                        <img
                          src={m.image}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-lg border border-ink-line object-cover"
                        />
                      ) : (
                        <span className="h-9 w-9 shrink-0 rounded-lg border border-ink-line bg-ink-soft" />
                      )}
                      <div>
                        <p className="font-medium text-cream">{m.name}</p>
                        {m.variants && (
                          <p className="text-xs text-cream-dim">
                            {m.variants.map((v) => v.label).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-cream-dim">{m.category}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gold">{priceLabel(m)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-center">
                      <button
                        onClick={() => toggleMenuItem(m.id)}
                        title={m.active !== false ? 'Available' : 'Hidden from POS'}
                        className={`relative h-6 w-11 rounded-full transition ${
                          m.active !== false ? 'bg-emerald-500/70' : 'bg-ink-line'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-cream transition-all ${
                            m.active !== false ? 'left-[22px]' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setModalItem(m)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-cream-dim transition hover:border-gold/40 hover:text-gold"
                        title="Edit"
                      >
                        <IconEdit size={15} />
                      </button>
                      <button
                        onClick={() => deleteMenuItem(m.id)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-cream-dim transition hover:border-rose-500/40 hover:text-rose-300"
                        title="Delete"
                      >
                        <IconTrash size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-cream-dim">No items match your search.</div>
        )}
      </div>

      {modalItem !== undefined && (
        <ItemModal
          item={modalItem}
          categories={menuCategories}
          onSave={onSave}
          onClose={() => setModalItem(undefined)}
        />
      )}

      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setConfirmingDelete(null)}
          />
          <div className="relative z-10 w-full max-w-sm animate-fade-up">
            <div className="card p-6">
              <h3 className="font-serif text-xl text-cream">Delete category?</h3>
              <p className="mt-2 text-sm text-cream-dim">
                Delete the empty category “<span className="text-cream">{confirmingDelete}</span>”?
                This can’t be undone.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={confirmDeleteCategory}
                  className="flex-1 rounded-xl bg-rose-500/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmingDelete(null)}
                  className="btn-ghost flex-1 py-2.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
