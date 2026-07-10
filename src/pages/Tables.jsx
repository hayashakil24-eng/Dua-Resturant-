import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { PageHeader, PaymentBadge } from '../components/ui.jsx'
import { money, time } from '../utils/format.js'
import {
  IconTable,
  IconClose,
  IconPOS,
  IconPlus,
  IconTrash,
  IconEdit,
} from '../components/Icons.jsx'

const URGENT_MINS = 15
const minutesSince = (iso, now) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))

function TableCard({ info, now, onClick }) {
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
    <button onClick={onClick} className={`flex flex-col rounded-2xl border-2 p-4 text-left transition ${tone}`}>
      <div className="flex items-center justify-between">
        <span className={`flex h-2.5 w-2.5 rounded-full ${inUse ? 'bg-rose-400' : 'bg-emerald-400'}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-cream-dim">
          {inUse ? 'In use' : 'Available'}
        </span>
      </div>

      <p className="mt-2 font-serif text-2xl font-bold text-cream">Table {info.id}</p>

      {inUse ? (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-cream-dim">
            {itemCount} item{itemCount !== 1 ? 's' : ''} ·{' '}
            <span className={urgent ? 'font-semibold text-rose-300' : 'text-cream'}>
              {mins} min{urgent && ' ⚠️'}
            </span>
          </p>
          <p className="truncate text-xs text-cream-dim">👤 {info.order.waiter}</p>
          <div className="mt-1 space-y-0.5">
            {info.order.items.slice(0, 2).map((it) => (
              <p key={it.id} className="truncate text-[11px] text-cream-dim">
                • {it.name} ×{it.qty}
              </p>
            ))}
            {info.order.items.length > 2 && (
              <p className="text-[11px] text-cream-dim/70">• +{info.order.items.length - 2} more</p>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-cream-dim">Seats {info.seats} · tap to start order</p>
      )}
    </button>
  )
}

function OrderDetailsModal({ order, orderTotal, onClose }) {
  const { subtotal, tax, discount, total } = orderTotal(order.items, order.discount?.amount)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-2xl text-cream">Table {order.table}</h3>
              <p className="mt-0.5 text-xs text-cream-dim">
                {order.id} · {order.waiter} · {time(order.createdAt)}
              </p>
            </div>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <PaymentBadge status={order.payment} />
            <span className="badge bg-white/5 text-cream-dim ring-1 ring-ink-line">
              Kitchen: {order.kitchen || '—'}
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
              <span>Subtotal</span>
              <span className="text-cream">{money(subtotal)}</span>
            </div>
            <div className="flex justify-between text-cream-dim">
              <span>GST</span>
              <span className="text-cream">{money(tax)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-300">
                <span>Discount{order.discount?.reason ? ` (${order.discount.reason})` : ''}</span>
                <span>- {money(discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="font-serif text-lg text-cream">Total</span>
              <span className="font-serif text-2xl font-semibold text-gold">{money(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TablesManageModal({ tables, occupied, canDelete, onAdd, onUpdate, onDelete, onClose }) {
  const [editingId, setEditingId] = useState(null)
  const [number, setNumber] = useState('')
  const [capacity, setCapacity] = useState('4')
  const [section, setSection] = useState('')

  const reset = () => {
    setEditingId(null)
    setNumber('')
    setCapacity('4')
    setSection('')
  }

  const numTaken = tables.some((t) => t.id === Number(number)) && Number(number) !== editingId
  const valid = Number(number) > 0 && Number(capacity) > 0 && (editingId != null || !numTaken)

  const submit = () => {
    if (!valid) return
    if (editingId != null) {
      onUpdate(editingId, { seats: Number(capacity), section })
    } else {
      onAdd({ id: Number(number), seats: Number(capacity), section })
    }
    reset()
  }

  const startEdit = (t) => {
    setEditingId(t.id)
    setNumber(String(t.id))
    setCapacity(String(t.seats))
    setSection(t.section || '')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-fade-up">
        <div className="card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between">
            <h3 className="font-serif text-2xl text-cream">Manage Tables</h3>
            <button onClick={onClose} className="text-cream-dim hover:text-cream">
              <IconClose size={20} />
            </button>
          </div>

          {/* Add / edit form */}
          <div className="mt-5 rounded-xl border border-ink-line bg-ink-soft/50 p-4">
            <p className="mb-3 text-[11px] uppercase tracking-wider text-cream-dim">
              {editingId != null ? `Edit Table ${editingId}` : 'Add a table'}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min={1}
                className="input py-2"
                placeholder="Number"
                value={number}
                disabled={editingId != null}
                onChange={(e) => setNumber(e.target.value)}
              />
              <input
                type="number"
                min={1}
                className="input py-2"
                placeholder="Capacity"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
              <input
                className="input py-2"
                placeholder="Section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
              />
            </div>
            {numTaken && editingId == null && (
              <p className="mt-2 text-xs text-rose-300">Table {number} already exists.</p>
            )}
            <div className="mt-3 flex gap-2">
              {editingId != null && (
                <button onClick={reset} className="btn-ghost flex-1 py-2 text-sm">
                  Cancel edit
                </button>
              )}
              <button
                onClick={submit}
                disabled={!valid}
                className="btn-gold flex-1 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconPlus size={16} /> {editingId != null ? 'Update Table' : 'Add Table'}
              </button>
            </div>
          </div>

          {/* Existing tables */}
          <div className="mt-4 divide-y divide-ink-line">
            {tables.map((t) => {
              const inUse = occupied.has(t.id)
              return (
                <div key={t.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-cream">
                      Table {t.id} <span className="text-cream-dim">· {t.seats} seats</span>
                    </p>
                    {t.section && <p className="text-xs text-cream-dim">{t.section}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(t)}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-cream-dim transition hover:border-gold/40 hover:text-gold"
                      title="Edit"
                    >
                      <IconEdit size={15} />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => onDelete(t.id)}
                        disabled={inUse}
                        title={inUse ? 'Table in use — cannot delete' : 'Delete'}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line text-cream-dim transition hover:border-rose-500/40 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <IconTrash size={15} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const TABS = [
  { key: 'running', label: 'Running', dot: 'bg-rose-400' },
  { key: 'available', label: 'Available', dot: 'bg-emerald-400' },
  { key: 'all', label: 'All Tables', dot: 'bg-gold' },
]

export default function Tables() {
  const { orders, orderTotal, tables, addTable, updateTable, deleteTable, user } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const [detail, setDetail] = useState(null)
  const [manage, setManage] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // Live timers — refresh every 15s so "minutes in use" stays current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(id)
  }, [])

  // Each table's status = its oldest active (unpaid, non-cancelled) order, if any.
  const tableInfo = useMemo(
    () =>
      tables.map((t) => {
        const order = orders
          .filter((o) => o.table === t.id && o.payment === 'Unpaid' && !o.cancelled)
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0]
        return { ...t, order: order || null, status: order ? 'in-use' : 'available' }
      }),
    [orders, tables],
  )

  const running = tableInfo.filter((t) => t.status === 'in-use')
  const available = tableInfo.filter((t) => t.status === 'available')
  const occupied = new Set(running.map((t) => t.id))
  const groups = { running, available, all: tableInfo }
  const shown = groups[tab]

  const onCardClick = (info) => {
    if (info.status === 'in-use') setDetail(info.order)
    else navigate('/pos', { state: { presetTable: info.id } })
  }

  return (
    <div>
      <PageHeader title="Tables" subtitle="Live floor status — running, available and full overview.">
        <button onClick={() => setManage(true)} className="btn-ghost px-4 py-2 text-sm">
          <IconTable size={16} /> Manage Tables
        </button>
      </PageHeader>

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-2 border-b border-ink-line pb-4">
        {TABS.map((t) => {
          const count = groups[t.key].length
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                tab === t.key
                  ? 'border-gold/60 bg-gold/12 text-gold'
                  : 'border-ink-line bg-ink-soft text-cream-dim hover:text-cream'
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${t.dot}`} />
              {t.label} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {shown.length === 0 ? (
        <div className="card grid place-items-center p-12 text-center text-sm text-cream-dim">
          {tab === 'running' && 'No tables in use right now.'}
          {tab === 'available' && 'All tables are occupied!'}
          {tab === 'all' && 'No tables configured.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((info) => (
            <TableCard key={info.id} info={info} now={now} onClick={() => onCardClick(info)} />
          ))}
        </div>
      )}

      {/* Stats footer */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-line bg-ink-soft/40 px-5 py-4 text-sm">
        <span className="flex items-center gap-2 text-cream-dim">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> In use:{' '}
          <span className="font-semibold text-cream">{running.length}</span>
        </span>
        <span className="flex items-center gap-2 text-cream-dim">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Available:{' '}
          <span className="font-semibold text-cream">{available.length}</span>
        </span>
        <span className="flex items-center gap-2 text-cream-dim">
          <IconTable size={16} /> Total:{' '}
          <span className="font-semibold text-cream">{tableInfo.length}</span>
        </span>
        <button onClick={() => navigate('/pos')} className="btn-gold px-4 py-2 text-sm">
          <IconPOS size={16} /> New Order
        </button>
      </div>

      {detail && (
        <OrderDetailsModal order={detail} orderTotal={orderTotal} onClose={() => setDetail(null)} />
      )}

      {manage && (
        <TablesManageModal
          tables={tables}
          occupied={occupied}
          canDelete={user?.role === 'Admin'}
          onAdd={addTable}
          onUpdate={updateTable}
          onDelete={deleteTable}
          onClose={() => setManage(false)}
        />
      )}
    </div>
  )
}
