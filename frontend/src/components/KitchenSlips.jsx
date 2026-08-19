import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext.jsx'
import { tableLabel, SPECIAL_TABLE_IDS } from '../data/mockData.js'
import { formatQty } from '../utils/format.js'
import { groupOrderItemsByDepartment } from '../utils/kot.js'

// Groups an order's items by department (counter) and renders one thermal-style
// slip per counter into a <body>-level portal (#printable-kots). The slips are
// hidden on screen; the @media print rule (body.print-kot) hides the whole app
// and reveals the portal so each counter's slip prints on its own page.
//
// Rendered continuously (with the just-placed order); printing is triggered by
// safePrint('print-kot') from the POS after an order is sent to the kitchen.
//
// Mirrors escpos.js's buildKotEscPos() field-for-field (see that function's
// header comment) — this is the browser-dev-mode / no-Electron fallback for
// the same docket, so the two must not drift.
export default function KitchenSlips({ order }) {
  const { getDepartmentForItem, menu, user } = useApp()
  if (!order || !order.items?.length) return null

  const { slips, unitOf } = groupOrderItemsByDepartment(order, { getDepartmentForItem, menu })

  const d = new Date(order.createdAt || Date.now())
  const dateStr = d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })

  const orderNo = (String(order.id).match(/\d+/) || [order.id])[0]
  const orderTypeLabel =
    Number(order.table) === SPECIAL_TABLE_IDS.delivery
      ? 'DELIVERY'
      : Number(order.table) === SPECIAL_TABLE_IDS.takeaway
        ? 'TAKEAWAY'
        : 'DINE IN'
  // Only delivery orders carry a real customer name in this app's data
  // model — "Walking Customer" is the same fallback used elsewhere for an
  // unnamed walk-in.
  const clientName = order.deliveryCustomerName || 'Walking Customer'

  return createPortal(
    <div id="printable-kots" aria-hidden="true">
      {slips.map((g, i) => {
        const totalQty = g.items.reduce((s, it) => s + (it.cancelled ? 0 : Number(it.qty) || 0), 0)
        return (
          <div className="kot-slip" key={g.name + i}>
            <div className="kot-title">CAFÉ ALI</div>
            {order.reprint && <div className="kot-reprint">⟳ REPRINT</div>}
            <div className="kot-dept">{g.name.toUpperCase()}</div>
            <div className="kot-dept">Order # {orderNo}</div>
            <div className="kot-type">{orderTypeLabel}</div>
            <div className="kot-meta">
              <div className="kot-row"><span>TABLE</span><b>{tableLabel(order.table)}</b></div>
              <div className="kot-row"><span>WAITER</span><b>{order.waiter || '—'}</b></div>
              <div className="kot-row"><span>{dateStr}</span><span>{timeStr}</span></div>
              <div className="kot-row"><span>CLIENT</span><b>{clientName}</b></div>
            </div>
            <div className="kot-hr" />
            <div className="kot-item">
              <span className="kot-item-sr">Sr</span>
              <span className="kot-item-name">Item</span>
              <b>Qty</b>
            </div>
            <div className="kot-hr" />
            <div className="kot-items">
              {g.items.map((it, j) => (
                <div className="kot-item" key={it.id + j}>
                  <span className="kot-item-sr">{j + 1}</span>
                  <span className="kot-item-name">{it.name}</span>
                  <b>×{it.cancelled ? 0 : formatQty(it.qty, unitOf(it))}</b>
                </div>
              ))}
            </div>
            <div className="kot-hr" />
            <div className="kot-row"><span>TOTAL QTY</span><b>{totalQty}</b></div>
            <div className="kot-hr" />
            <div className="kot-marker">* ORDER # {orderNo} *</div>
            <div className="kot-foot">Slip {i + 1} / {slips.length}</div>
            <div className="kot-hr" />
            <div className="kot-meta">
              <div className="kot-row"><span>CASHIER</span><b>{user?.name || '—'}</b></div>
              <div className="kot-row"><span>CELL</span><b>03132870111</b></div>
              <div className="kot-row"><span>EMAIL</span><b>cafealihawksbay@gmail.com</b></div>
            </div>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
