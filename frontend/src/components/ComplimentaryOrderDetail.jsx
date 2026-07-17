import { useApp } from '../context/AppContext.jsx'
import { money } from '../utils/format.js'
import { lineCost, complimentaryCost, formatCostTotal } from '../utils/cost.js'

const TONES = {
  blue: 'border-blue-300 text-blue-700 [&_strong]:text-blue-900',
  red: 'border-red-300 text-red-700 [&_strong]:text-red-900',
  orange: 'border-orange-300 text-orange-700 [&_strong]:text-orange-900',
}

// Label + hint on the left, figure on the right. `break-words` on the value so
// a long string ("Unknown", a 7-digit total) wraps instead of spilling out.
function SummaryRow({ tone, label, hint, value }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded border-2 bg-white p-2.5 ${TONES[tone]}`}>
      <div className="min-w-0">
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-[11px] opacity-80">{hint}</p>
      </div>
      <strong className="shrink-0 break-words text-lg font-bold">{value}</strong>
    </div>
  )
}

// Cost breakdown for a complimentary (free / on-the-house) order.
//
// The point of this panel: giving away a Rs. 5,000 bill does NOT cost the cafe
// Rs. 5,000 — it costs whatever the ingredients cost. The lost revenue is real
// but it is margin never earned, not cash out the door. Accounting should book
// the COGS figure, which is why that number is the emphasised one.
export default function ComplimentaryOrderDetail({ order }) {
  const { menu, orderTotal } = useApp()
  const { billTotal, costTotal, lostMargin, anyEstimated, allKnown } = complimentaryCost(
    order,
    menu,
    orderTotal,
  )

  return (
    <div className="rounded-lg border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-lg font-bold text-amber-900">
          🎁 Complimentary Order Details
        </h3>
        <p className="mt-1 text-sm text-amber-700">
          Ordered by: <strong>{order.complimentary?.orderedBy || '—'}</strong>
          {order.complimentary?.reason ? (
            <> | Reason: <strong>{order.complimentary.reason}</strong></>
          ) : null}
        </p>
      </div>

      <div className="mb-4 overflow-x-auto">
        <h4 className="mb-2 font-semibold text-amber-900">Items Breakdown:</h4>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-amber-300">
              <th className="px-2 py-1 text-left text-amber-900">Item</th>
              <th className="px-2 py-1 text-center text-amber-900">Qty</th>
              <th className="px-2 py-1 text-right text-amber-900">Price</th>
              <th className="px-2 py-1 text-right text-amber-900">Est. Cost</th>
              <th className="px-2 py-1 text-right text-amber-900">Total Cost</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => {
              const unitCost = lineCost(item, menu)
              return (
                <tr key={item.key || item.id} className="border-b border-amber-200 hover:bg-amber-100">
                  <td className="px-2 py-1 text-gray-800">{item.name}</td>
                  <td className="px-2 py-1 text-center text-gray-800">{item.qty}</td>
                  <td className="px-2 py-1 text-right text-gray-800">{money(item.price * item.qty)}</td>
                  <td className="px-2 py-1 text-right text-xs text-gray-600">
                    {unitCost == null ? '—' : money(unitCost)}
                  </td>
                  <td className="px-2 py-1 text-right font-semibold text-amber-800">
                    {unitCost == null ? '—' : money(unitCost * item.qty)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Stacked rows, not a 3-up grid: this panel renders inside the ~384px
          receipt modal, and Tailwind's sm: tracks the viewport, not the
          container — so a 3-column grid collapses into unreadable slivers. */}
      <div className="mb-4 space-y-2">
        <SummaryRow
          tone="blue"
          label="Full Bill Amount"
          hint="What the customer would have paid"
          value={money(billTotal)}
        />
        <SummaryRow
          tone="red"
          label="Est. Cost of Inventory"
          hint={allKnown ? 'Estimated actual cost to the cafe' : 'Some items have no cost on file'}
          value={formatCostTotal({ costTotal, allKnown }, money)}
        />
        <SummaryRow
          tone="orange"
          label="Lost Margin"
          hint="Revenue never earned (not a cash loss)"
          value={allKnown ? money(lostMargin) : '—'}
        />
      </div>

      <div className="rounded border border-amber-200 bg-white p-2">
        <p className="text-xs text-gray-600">
          <strong>📌 Note:</strong> Accounting should record the loss as{' '}
          <strong>{allKnown ? money(costTotal) : 'the ingredient cost'}</strong>, not the full bill of{' '}
          <strong>{money(billTotal)}</strong> — the rest is margin that was never earned.
        </p>
        {anyEstimated && (
          <p className="mt-1 text-xs text-gray-500">
            ⚠️ Cost figures are <strong>estimates</strong> seeded from category food-cost ratios, not
            measured purchase prices. Do not use them for filing until real costs are entered.
          </p>
        )}
      </div>
    </div>
  )
}
