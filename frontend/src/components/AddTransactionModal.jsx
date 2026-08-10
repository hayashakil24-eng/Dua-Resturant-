import { useState } from 'react'
import { useT } from '../i18n/LanguageContext.jsx'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { toDayStr } from '../utils/closing.js'
import { hasItemizedFields } from '../utils/accounting.js'
import { EXPENSE_CATEGORIES } from '../data/mockData.js'
import { IconClose, IconCheck } from './Icons.jsx'

const MAINTENANCE_TYPES = ['labour', 'material', 'rent', 'fuel', 'other']

// Shared by Accounting.jsx's full ledger entry form and the Cashier's narrow
// quick-add-expense entry point (POS header) — same fields, same validation.
// Both only ever post type:'expense' (income is the POS sales total, auto).
export default function AddTransactionModal({ onClose, onSave }) {
  const t = useT()
  const type = 'expense'
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [subCategory, setSubCategory] = useState(MAINTENANCE_TYPES[0])
  const [vendor, setVendor] = useState('')
  // Local date, not UTC: toISOString() converts to UTC first, which silently
  // dated any transaction entered between local midnight and ~5 AM (Pakistan,
  // UTC+5) as "yesterday" — invisible in Daily view's exact-date match even
  // though Monthly's looser year/month check tolerated it.
  const [date, setDate] = useState(() => toDayStr(new Date()))
  useEscapeKey(onClose)

  const showVendorFields = hasItemizedFields(category)
  const cats = EXPENSE_CATEGORIES
  const valid = Number(amount) > 0 && description.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <h3 className="font-serif text-2xl text-cream">{t('accounting.addExpense')}</h3>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('accounting.category')}
              </label>
              <select className="input py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
                {cats.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                {t('accounting.description')}
              </label>
              <input
                className="input"
                placeholder={t('accounting.descriptionPh')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {/* Itemized breakdown (type + who was paid) — Maintenance and
                Daily Wages both track this; the client's Excel ledger lists
                Labour/Material/Rent/Fuel/Other with a vendor/person name for
                Maintenance rows, and just a person name (subCategory=labour)
                for Daily Wages rows (Butcher/Tandoor/Kitchen Double, ...). */}
            {showVendorFields && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                    {t('accounting.maintenanceType')}
                  </label>
                  <select className="input py-2" value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
                    {MAINTENANCE_TYPES.map((mt) => (
                      <option key={mt} value={mt}>
                        {t(`accounting.maintenanceTypes.${mt}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                    {t('accounting.vendor')}
                  </label>
                  <input
                    className="input"
                    placeholder={t('accounting.vendorPh')}
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  {t('accounting.amountRs')}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="input"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-cream-dim">
                  {t('accounting.date')}
                </label>
                <input
                  type="date"
                  className="input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              {t('common.cancel')}
            </button>
            <button
              onClick={() => {
                onSave({
                  type,
                  category,
                  description: description.trim(),
                  amount: Number(amount),
                  date: new Date(date).toISOString(),
                  ...(showVendorFields ? { subCategory, vendor: vendor.trim() } : {}),
                })
                onClose()
              }}
              disabled={!valid}
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
