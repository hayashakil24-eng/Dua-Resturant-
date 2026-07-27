import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { PageHeader, PaymentBadge } from '../components/ui.jsx'
import { canModify, hasAccess } from '../config/permissions.js'
import ShiftTableModal from '../components/ShiftTableModal.jsx'
import TableFormModal from '../components/TableFormModal.jsx'
import { money, time } from '../utils/format.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { pageWindow } from '../utils/pageWindow.js'
import {
  IconTable,
  IconClose,
  IconPOS,
  IconPlus,
  IconTrash,
  IconEdit,
  IconSearch,
} from '../components/Icons.jsx'

const URGENT_MINS = 15
const minutesSince = (iso, now) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))

function TableCard({ info, now, onClick }) {
  const t = useT()
  const inUse = info.status === 'in-use'
  const mins = inUse ? minutesSince(info.order.createdAt, now) : 0
  const urgent = inUse && mins >= URGENT_MINS
  const itemCount = inUse ? info.order.items.reduce((s, i) => s + i.qty, 0) : 0

  const tone = !inUse
    ? 'border-emerald-500/40 bg-emerald-500/[0.06] hover:border-emerald-500/70'
    : urgent
      ? 'border-rose-500/70 bg-rose-500/[0.14] hover:border-rose-400'
      : 'border-rose-500/40 bg-rose-500/[0.07] hover:border-rose-500/70'

  return (
    <button onClick={onClick} className={`flex flex-col rounded-2xl border-2 p-4 text-start transition ${tone}`}>
      <div className="flex items-center justify-between">
        <span className={`flex h-2.5 w-2.5 rounded-full ${inUse ? 'bg-rose-400' : 'bg-emerald-400'}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-cream-dim">
          {inUse ? t('tables.inUse') : t('tables.available')}
        </span>
      </div>

      <p className="mt-2 font-serif text-2xl font-bold text-cream">
        {info.number || `${t('tables.table')} ${info.id}`}
      </p>

      {inUse ? (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-cream-dim">
            {itemCount} {itemCount !== 1 ? t('tables.items') : t('tables.item')} ·{' '}
            <span className={urgent ? 'font-semibold text-rose-300' : 'text-cream'}>
              {mins} {t('tables.min')}{urgent && ' ⚠️'}
            </span>
          </p>
          <p className="truncate text-xs text-cream-dim">👤 {info.order.waiter || '—'}</p>
          <div className="mt-1 space-y-0.5">
            {info.order.items.slice(0, 2).map((it) => (
              <p key={it.id} className="truncate text-[11px] text-cream-dim">
                • {it.name} ×{it.qty}
              </p>
            ))}
            {info.order.items.length > 2 && (
              <p className="text-[11px] text-cream-dim">• +{info.order.items.length - 2} {t('tables.more')}</p>
            )}
          </div>
        </div>
      ) : info.orderType ? (
        <p className="mt-2 text-xs text-cream-dim">
          {info.orderType === 'delivery' ? '🚗' : '🛍️'} {t('tables.tapToStart')}
        </p>
      ) : (
        <p className="mt-2 text-xs text-cream-dim">{t('tables.seats')} {info.seats} · {t('tables.tapToStart')}</p>
      )}
    </button>
  )
}

function OrderDetailsModal({ order, tableLabel, orderTotal, onClose, canAddItems, onAddItems, canShiftTable, onShiftTable }) {
  const t = useT()
  useEscapeKey(onClose)
  const { subtotal, tax, discount, total } = orderTotal(order.items, order.discount?.amount, order.gstRate)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">{tableLabel || `${t('tables.table')} ${order.table}`}</h3>
              <p className="mt-0.5 text-xs text-cream-dim">
                {order.id} · {order.waiter || '—'} · {time(order.createdAt)}
              </p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <PaymentBadge status={order.payment} />
            <span className="badge bg-white/5 text-cream-dim ring-1 ring-ink-line">
              {t('tables.kitchen')}: {order.kitchen || '—'}
            </span>
          </div>

          <ul className="mt-4 divide-y divide-ink-line">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-cream">
                  {it.name} <span className="text-cream-dim">×{it.qty}</span>
                </span>
                <span className="font-semibold text-cream">{money(it.price * it.qty)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 space-y-1 border-t border-ink-line pt-3 text-sm">
            <div className="flex justify-between text-cream-dim">
              <span>{t('tables.subtotal')}</span>
              <span className="text-cream">{money(subtotal)}</span>
            </div>
            {tax > 0 && (
              <div className="flex justify-between text-cream-dim">
                <span>{t('tables.gst')}</span>
                <span className="text-cream">{money(tax)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-emerald-300">
                <span>
                  {t('tables.discount')}
                  {order.discount?.percent ? ` ${order.discount.percent}%` : ''}
                  {order.discount?.reason ? ` (${order.discount.reason})` : ''}
                </span>
                <span>- {money(discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="font-serif text-lg text-cream">{t('tables.total')}</span>
              <span className="font-serif text-2xl font-semibold text-gold">{money(total)}</span>
            </div>
          </div>

          {/* Running bill: add more items to this same order (one combined bill) */}
          {canAddItems && order.payment === 'Unpaid' && (
            <button onClick={onAddItems} className="btn-gold mt-5 w-full py-2.5 text-sm">
              <IconPlus size={16} /> {t('tables.addMoreItems')}
            </button>
          )}

          {/* Party moved seats: re-seat this running order onto another table. */}
          {canShiftTable && order.payment === 'Unpaid' && (
            <button onClick={onShiftTable} className="btn-ghost mt-2 w-full py-2.5 text-sm">
              <IconTable size={16} /> {t('tables.shiftTable')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const MANAGE_PAGE_SIZE = 20

// Manage Tables: halls on top (each opens the same form the add button uses),
// then a searchable, paginated list of every table. There is deliberately no
// per-table edit here — seats/section/label are hall-level properties now, so a
// 300-row list only needs delete, and that is behind a two-step confirm.
function TablesManageModal({ tables, occupied, canDelete, onBulkAdd, onUpdateCategory, onDelete, onDeleteCategory, onClose }) {
  const t = useT()
  const [form, setForm] = useState(null) // { mode: 'add' | 'edit', hall }
  const [catConfirmDelete, setCatConfirmDelete] = useState(null)
  const [catError, setCatError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [query, setQuery] = useState('')
  const [hallFilter, setHallFilter] = useState('')
  const [page, setPage] = useState(1)
  useEscapeKey(onClose)

  // Group tables by category, preserving id order within each group.
  const grouped = useMemo(() => {
    const m = new Map()
    for (const tbl of tables) {
      const k = tbl.category || 'Other'
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(tbl)
    }
    return [...m.entries()]
  }, [tables])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tables.filter((tbl) => {
      if (hallFilter && (tbl.category || 'Other') !== hallFilter) return false
      if (!q) return true
      return (tbl.number || `T${tbl.id}`).toLowerCase().includes(q) || String(tbl.id) === q
    })
  }, [tables, query, hallFilter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / MANAGE_PAGE_SIZE))
  // Clamp during render — filtering can shrink the list below the current page.
  const safePage = Math.min(page, pageCount)
  const shown = filtered.slice((safePage - 1) * MANAGE_PAGE_SIZE, safePage * MANAGE_PAGE_SIZE)

  const confirmCatDelete = async (cat) => {
    const res = await onDeleteCategory(cat)
    setCatConfirmDelete(null)
    if (res?.error) setCatError(res.error)
  }
  const removeTable = async (id) => {
    setCatError('')
    const res = await onDelete(id)
    setConfirmDeleteId(null)
    if (res?.error) setCatError(res.error)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <h3 className="font-serif text-2xl text-cream">{t('tables.manage')}</h3>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <button onClick={() => setForm({ mode: 'add' })} className="btn-gold mt-5 w-full py-2.5 text-sm">
            <IconPlus size={16} /> {t('tables.addTables')}
          </button>

          {catError && (
            <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {catError}
            </p>
          )}

          {/* Halls — edit opens the same form as adding; delete removes the group */}
          <p className="mt-6 text-[11px] uppercase tracking-wider text-cream-dim">{t('tables.halls')}</p>
          <div className="mt-2 divide-y divide-ink-line rounded-xl border border-ink-line">
            {grouped.map(([cat, members]) => {
              const allLocked = members.every((m) => m.locked)
              const groupOccupied = members.some((m) => occupied.has(m.id))
              return (
                <div key={cat} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <p className="text-sm font-semibold text-gold">
                    {cat} <span className="font-normal text-cream-dim">· {members.length}</span>
                  </p>
                  {allLocked ? (
                    <span className="text-xs text-cream-dim">🔒 {t('tables.locked')}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setForm({ mode: 'edit', hall: cat })}
                        title={t('tables.editHall')}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-cream-dim transition hover:border-gold/40 hover:text-gold"
                      >
                        <IconEdit size={15} />
                      </button>
                      {canDelete &&
                        (catConfirmDelete === cat ? (
                          <div className="flex items-center gap-1 text-xs">
                            <button onClick={() => confirmCatDelete(cat)} className="font-semibold text-rose-300">
                              {t('tables.deleteAll')}
                            </button>
                            <button onClick={() => setCatConfirmDelete(null)} className="text-cream-dim hover:text-cream">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setCatError('')
                              setCatConfirmDelete(cat)
                            }}
                            disabled={groupOccupied}
                            title={groupOccupied ? t('tables.inUse') : t('tables.deleteCategory')}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-cream-dim transition hover:border-rose-500/40 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <IconTrash size={15} />
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Every table — search + paginate rather than a 300-row scroll */}
          <p className="mt-6 text-[11px] uppercase tracking-wider text-cream-dim">
            {t('tables.allTables')} <span className="text-cream-dim">· {filtered.length}</span>
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-cream-dim">
                <IconSearch size={16} />
              </span>
              <input
                className="input ps-9"
                placeholder={t('tables.searchInManage')}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1) // a new search always restarts at the first page
                }}
              />
            </div>
            <select
              className="input"
              value={hallFilter}
              onChange={(e) => {
                setHallFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">{t('tables.allHalls')}</option>
              {grouped.map(([cat]) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-2 divide-y divide-ink-line">
            {shown.map((tbl) => {
              const inUse = occupied.has(tbl.id)
              return (
                <div key={tbl.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-cream">
                      {tbl.number || `${t('tables.table')} ${tbl.id}`}
                      {!tbl.locked && (
                        <span className="text-cream-dim"> · {tbl.seats} {t('tables.seatsWord')}</span>
                      )}
                    </p>
                    <p className="text-xs text-cream-dim">
                      {tbl.category || 'Other'}
                      {tbl.section ? ` · ${tbl.section}` : ''}
                    </p>
                  </div>
                  {tbl.locked ? (
                    <span className="shrink-0 text-xs text-cream-dim">🔒 {t('tables.locked')}</span>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      {inUse && (
                        <span className="badge bg-rose-500/12 text-rose-300 ring-1 ring-rose-500/30">
                          {t('tables.inUse')}
                        </span>
                      )}
                      {canDelete &&
                        (confirmDeleteId === tbl.id ? (
                          <div className="flex items-center gap-1 text-xs">
                            <button onClick={() => removeTable(tbl.id)} className="font-semibold text-rose-300">
                              {t('tables.confirmDelete')}
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)} className="text-cream-dim hover:text-cream">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setCatError('')
                              setConfirmDeleteId(tbl.id)
                            }}
                            disabled={inUse}
                            title={inUse ? t('tables.inUse') : t('common.delete')}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-cream-dim transition hover:border-rose-500/40 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <IconTrash size={15} />
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )
            })}
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-cream-dim">{t('tables.noTablesMatch')}</p>
            )}
          </div>

          {pageCount > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              {pageWindow(safePage, pageCount).map((p, i) =>
                p === '…' ? (
                  <span key={`gap-${i}`} className="px-1 text-xs text-cream-dim">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-8 rounded-lg border px-2 py-1 text-xs font-semibold transition ${
                      p === safePage
                        ? 'border-gold/50 bg-gold/12 text-gold'
                        : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      {form && (
        <TableFormModal
          mode={form.mode}
          hall={form.hall}
          tables={tables}
          onAdd={onBulkAdd}
          onUpdateHall={onUpdateCategory}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  )
}

const TABLES_PAGE_SIZE = 24

const TABS = [
  { key: 'running', labelKey: 'tables.running', dot: 'bg-rose-400' },
  { key: 'available', labelKey: 'tables.available', dot: 'bg-emerald-400' },
  { key: 'all', labelKey: 'tables.allTables', dot: 'bg-gold' },
]

export default function Tables() {
  const { orders, orderTotal, tables, bulkAddTables, deleteTable, updateTableCategory, deleteTableCategory, shiftOrderTable, user } = useApp()
  const t = useT()
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const [cat, setCat] = useState('All') // 'All' | 'A'…'H' | 'Special'
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState(null)
  const [shiftTarget, setShiftTarget] = useState(null) // running order → move to another table
  const [manage, setManage] = useState(false)
  const [page, setPage] = useState(1)
  const [now, setNow] = useState(() => Date.now())
  const catScrollRef = useRef(null)
  const scrollCats = (dir) =>
    catScrollRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' })

  // Live timers — refresh every 15s so "minutes in use" stays current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(id)
  }, [])

  // Each table's status = its oldest active (unpaid, non-cancelled) order, if any.
  const tableInfo = useMemo(
    () =>
      tables.map((tbl) => {
        const order = orders
          .filter((o) => o.table === tbl.id && o.payment === 'Unpaid' && !o.cancelled)
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0]
        return { ...tbl, order: order || null, status: order ? 'in-use' : 'available' }
      }),
    [orders, tables],
  )

  const running = tableInfo.filter((tbl) => tbl.status === 'in-use')
  const available = tableInfo.filter((tbl) => tbl.status === 'available')
  const occupied = new Set(running.map((tbl) => tbl.id))
  const groups = { running, available, all: tableInfo }

  // Apply the status tab, then the category filter (A–H / Special), then search.
  // Categories are derived live from the tables so renamed categories appear.
  const liveCats = [...new Set(tables.map((tb) => tb.category).filter(Boolean))].sort()
  const catTabs = ['All', ...liveCats]
  let shown = groups[tab]
  if (cat !== 'All') shown = shown.filter((i) => i.category === cat)
  const query = q.trim().toLowerCase()
  if (query) shown = shown.filter((i) => (i.number || '').toLowerCase().includes(query))

  // Paginate the grid — a restaurant here runs 300+ tables (see pageWindow.js),
  // so rendering every card at once would make the tab unusably long.
  const pageCount = Math.max(1, Math.ceil(shown.length / TABLES_PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const paged = shown.slice((safePage - 1) * TABLES_PAGE_SIZE, safePage * TABLES_PAGE_SIZE)

  // Add/manage tables is Admin+Manager only; adding items to a running order
  // needs POS access (Cashier + Admin — Manager has no POS).
  const canManageTables = user && canModify(user.role, 'tableAdd')
  const canAddItems = user && hasAccess(user.role, 'pos')
  // Re-seating a running order is a running-order edit (same gate as Orders page).
  const canShiftTable = user && canModify(user.role, 'orders')

  const onCardClick = (info) => {
    if (info.status === 'in-use') setDetail(info.order)
    else navigate('/pos', { state: { presetTable: info.id } })
  }

  const continueOrder = (order) =>
    navigate('/pos', { state: { continueOrderId: order.id } })

  return (
    <div>
      <PageHeader title={t('tables.title')} subtitle={t('tables.subtitle')}>
        {canManageTables && (
          <button onClick={() => setManage(true)} className="btn-ghost px-4 py-2 text-sm">
            <IconTable size={16} /> {t('tables.manage')}
          </button>
        )}
      </PageHeader>

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-2 border-b border-ink-line pb-4">
        {TABS.map((tb) => {
          const count = groups[tb.key].length
          return (
            <button
              key={tb.key}
              onClick={() => {
                setTab(tb.key)
                setPage(1)
              }}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                tab === tb.key
                  ? 'border-gold/60 bg-gold/12 text-gold'
                  : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${tb.dot}`} />
              {t(tb.labelKey)} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Category chips (A–H + Special) + search by table number.
          Left/right arrows scroll the pill row so no category is ever clipped. */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2 lg:flex-1">
          <button
            onClick={() => scrollCats('left')}
            aria-label="Scroll categories left"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-line bg-ink-soft text-lg leading-none text-gold transition hover:border-gold/50"
          >
            ‹
          </button>
          <div
            ref={catScrollRef}
            className="scrollbar-hide flex flex-1 touch-pan-x gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-1"
          >
          {catTabs.map((c) => (
            <button
              key={c}
              onClick={() => {
                setCat(c)
                setPage(1)
              }}
              className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                cat === c
                  ? 'border-gold/60 bg-gold/12 text-gold'
                  : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
              }`}
            >
              {c === 'All'
                ? t('tables.allTables')
                : c === 'Special'
                  ? t('tables.specialTypes')
                  : c === 'HUT'
                    ? t('tables.hut')
                    : `${t('tables.category')} ${c}`}
            </button>
          ))}
          </div>
          <button
            onClick={() => scrollCats('right')}
            aria-label="Scroll categories right"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-line bg-ink-soft text-lg leading-none text-gold transition hover:border-gold/50"
          >
            ›
          </button>
        </div>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          placeholder={t('tables.searchPlaceholder')}
          className="input w-full py-2 lg:w-56"
        />
      </div>

      {/* Grid */}
      {shown.length === 0 ? (
        <div className="card grid place-items-center p-12 text-center text-sm text-cream-dim">
          {query || cat !== 'All'
            ? t('tables.noResults')
            : tab === 'running'
              ? t('tables.noneRunning')
              : tab === 'available'
                ? t('tables.allOccupied')
                : t('tables.noneConfigured')}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {paged.map((info) => (
              <TableCard key={info.id} info={info} now={now} onClick={() => onCardClick(info)} />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
              {pageWindow(safePage, pageCount).map((p, i) =>
                p === '…' ? (
                  <span key={`gap-${i}`} className="px-1 text-xs text-cream-dim">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-8 rounded-lg border px-2 py-1 text-xs font-semibold transition ${
                      p === safePage
                        ? 'border-gold/50 bg-gold/12 text-gold'
                        : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
            </div>
          )}
        </>
      )}

      {/* Stats footer */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-line bg-ink-soft/40 px-5 py-4 text-sm">
        <span className="flex items-center gap-2 text-cream-dim">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> {t('tables.inUse')}:{' '}
          <span className="font-semibold text-cream">{running.length}</span>
        </span>
        <span className="flex items-center gap-2 text-cream-dim">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> {t('tables.available')}:{' '}
          <span className="font-semibold text-cream">{available.length}</span>
        </span>
        <span className="flex items-center gap-2 text-cream-dim">
          <IconTable size={16} /> {t('tables.totalLabel')}:{' '}
          <span className="font-semibold text-cream">{tableInfo.length}</span>
        </span>
        <button onClick={() => navigate('/pos')} className="btn-gold px-4 py-2 text-sm">
          <IconPOS size={16} /> {t('nav.newOrder')}
        </button>
      </div>

      {detail && (
        <OrderDetailsModal
          order={detail}
          tableLabel={tables.find((tb) => tb.id === detail.table)?.number}
          orderTotal={orderTotal}
          canAddItems={canAddItems}
          onAddItems={() => continueOrder(detail)}
          canShiftTable={canShiftTable}
          onShiftTable={() => {
            setShiftTarget(detail)
            setDetail(null)
          }}
          onClose={() => setDetail(null)}
        />
      )}

      {shiftTarget && (
        <ShiftTableModal
          order={shiftTarget}
          onConfirm={async (tableId) => {
            const res = await shiftOrderTable(shiftTarget.id, tableId)
            if (res?.error) return
            setShiftTarget(null)
          }}
          onClose={() => setShiftTarget(null)}
        />
      )}

      {manage && (
        <TablesManageModal
          tables={tables}
          occupied={occupied}
          canDelete={user?.role === 'Admin'}
          onBulkAdd={bulkAddTables}
          onUpdateCategory={updateTableCategory}
          onDelete={deleteTable}
          onDeleteCategory={deleteTableCategory}
          onClose={() => setManage(false)}
        />
      )}
    </div>
  )
}
