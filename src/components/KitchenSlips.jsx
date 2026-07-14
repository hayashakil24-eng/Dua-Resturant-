import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext.jsx'
import { tableLabel } from '../data/mockData.js'

// Groups an order's items by department (counter) and renders one thermal-style
// slip per counter into a <body>-level portal (#printable-kots). The slips are
// hidden on screen; the @media print rule (body.print-kot) hides the whole app
// and reveals the portal so each counter's slip prints on its own page.
//
// Rendered continuously (with the just-placed order); printing is triggered by
// safePrint('print-kot') from the POS after an order is sent to the kitchen.
export default function KitchenSlips({ order }) {
  const { getDepartmentForItem } = useApp()
  if (!order || !order.items?.length) return null

  // One group per counter; unmapped items fall back to a single "Kitchen" slip.
  const groups = new Map()
  order.items.forEach((it) => {
    const dept = getDepartmentForItem(it.id)
    const id = dept?.id || 'kitchen'
    const name = dept?.name || 'Kitchen'
    if (!groups.has(id)) groups.set(id, { name, items: [] })
    groups.get(id).items.push(it)
  })
  const slips = [...groups.values()]

  const d = new Date(order.createdAt || Date.now())
  const dateStr = d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })

  return createPortal(
    <div id="printable-kots" aria-hidden="true">
      {slips.map((g, i) => (
        <div className="kot-slip" key={g.name + i}>
          <div className="kot-title">CAFÉ ALI</div>
          <div className="kot-dept">{g.name.toUpperCase()}</div>
          <div className="kot-meta">
            <div className="kot-row"><span>ORDER</span><b>{order.id}</b></div>
            <div className="kot-row"><span>TABLE</span><b>{tableLabel(order.table)}</b></div>
            <div className="kot-row"><span>WAITER</span><b>{order.waiter || '—'}</b></div>
          </div>
          <div className="kot-hr" />
          <div className="kot-items">
            {g.items.map((it, j) => (
              <div className="kot-item" key={it.id + j}>
                <span>{it.name}</span>
                <b>×{it.qty}</b>
              </div>
            ))}
          </div>
          <div className="kot-hr" />
          <div className="kot-foot">{dateStr} · {timeStr}</div>
          <div className="kot-foot">Slip {i + 1} / {slips.length}</div>
        </div>
      ))}
    </div>,
    document.body,
  )
}
