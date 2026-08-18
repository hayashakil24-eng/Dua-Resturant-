import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext.jsx'
import { tableLabel } from '../data/mockData.js'
import { formatQty } from '../utils/format.js'
import { groupOrderItemsByDepartment } from '../utils/kot.js'

// Groups an order's items by department (counter) and renders one thermal-style
// slip per counter into a <body>-level portal (#printable-kots). The slips are
// hidden on screen; the @media print rule (body.print-kot) hides the whole app
// and reveals the portal so each counter's slip prints on its own page.
//
// Rendered continuously (with the just-placed order); printing is triggered by
// safePrint('print-kot') from the POS after an order is sent to the kitchen.
export default function KitchenSlips({ order }) {
  const { getDepartmentForItem, menu } = useApp()
  if (!order || !order.items?.length) return null

  const { slips, unitOf } = groupOrderItemsByDepartment(order, { getDepartmentForItem, menu })

  const d = new Date(order.createdAt || Date.now())
  const dateStr = d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })

  return createPortal(
    <div id="printable-kots" aria-hidden="true">
      {slips.map((g, i) => (
        <div className="kot-slip" key={g.name + i}>
          <div className="kot-title">CAFÉ ALI</div>
          {order.reprint && <div className="kot-reprint">⟳ REPRINT</div>}
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
                <b>×{formatQty(it.qty, unitOf(it))}</b>
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
