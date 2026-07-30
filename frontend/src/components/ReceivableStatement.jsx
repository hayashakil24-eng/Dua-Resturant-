import { useState } from 'react'
import { money } from '../utils/format.js'
import { safePrint } from '../utils/print.js'
import { useEscapeKey } from '../hooks/useEscapeKey.js'
import { IconPrint, IconClose } from './Icons.jsx'

// A settlement payment has no single order to open a bill for — it's a
// lump-sum reduction against the whole account (see receivableAllocation.js).
// So "View Bill" on a payment row opens this instead: every order on the
// account, the combined total, what's been paid, and the resulting balance.
// Same visual chrome as Receipt (Billing.jsx) and its own print surface
// (#printable-statement) — this project gives every printable view its own
// id rather than reusing one, to avoid two slips overlapping on print.
export default function ReceivableStatement({ receivable, orderLabel, onClose }) {
  const [printing, setPrinting] = useState(false)
  useEscapeKey(onClose)

  const charges = [...(receivable.charges || [])].sort((a, b) => new Date(a.at) - new Date(b.at))
  const totalCharges = charges.reduce((s, c) => s + Number(c.amount || 0), 0)
  const totalPaid = (receivable.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)

  const handlePrint = () => {
    if (safePrint('print-statement')) {
      setPrinting(true)
      setTimeout(() => setPrinting(false), 1500)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm no-print" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-sm flex-col">
        <div className="min-h-0 overflow-y-auto">
          <div
            id="printable-statement"
            className="w-full shrink-0 rounded-2xl bg-white p-6 text-[#3E2723] shadow-lift border border-[#E8DCC4]"
            style={{ fontFamily: 'ui-monospace, monospace' }}
          >
            <div className="text-center">
              <div className="flex justify-center">
                <div className="font-serif text-2xl font-bold tracking-wide" style={{ color: '#C9A961' }}>
                  Cafe Ali
                </div>
              </div>
              <p className="mt-2 text-[11px] text-[#5D4037]">Hawksbay Road, Karachi · 021-111-ALI</p>
            </div>

            <div className="my-4 border-t border-dashed border-[#E8DCC4]" />

            <div className="grid grid-cols-2 gap-1 text-xs text-[#3E2723]">
              <span>Account Statement</span>
              <span className="text-right font-bold">{receivable.name}</span>
              <span>Date</span>
              <span className="text-right">{new Date().toLocaleDateString('en-PK')}</span>
            </div>

            <div className="my-4 border-t border-dashed border-[#E8DCC4]" />

            <table className="w-full text-xs text-[#3E2723]">
              <thead>
                <tr className="text-left text-[#3E2723]/80">
                  <th className="pb-1 font-medium">Order</th>
                  <th className="pb-1 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((c) => (
                  <tr key={c.id}>
                    <td className="py-0.5 pr-2">{c.orderId ? orderLabel(c.orderId) : '—'}</td>
                    <td className="py-0.5 text-right font-bold">{money(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="my-4 border-t border-dashed border-[#E8DCC4]" />

            <div className="space-y-1 text-xs text-[#3E2723]">
              <div className="flex justify-between">
                <span>Total</span>
                <span className="font-bold">{money(totalCharges)}</span>
              </div>
              {totalPaid > 0 && (
                <div className="flex justify-between">
                  <span>Paid</span>
                  <span className="font-bold">- {money(totalPaid)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-[#E8DCC4] pt-1 text-sm font-bold">
                <span>Balance Due</span>
                <span>{money(receivable.balance)}</span>
              </div>
            </div>

            <div className="my-4 border-t border-dashed border-[#E8DCC4]" />
            <p className="text-center text-[11px] text-[#5D4037]">
              Thank you for your business!
              <br />
              Please come again — Cafe Ali
            </p>

            <div className="mt-3 border-t border-dashed border-[#E8DCC4] pt-2 text-center">
              <p className="text-[12px] text-[#8D6E63]">Software by SoftDap</p>
            </div>
          </div>
        </div>

        <div className="w-full flex-shrink-0">
          <div className="mt-4 flex gap-3 no-print">
            <button
              onClick={handlePrint}
              disabled={printing}
              className="btn-gold flex-1 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconPrint size={18} /> {printing ? 'Printing…' : 'Print'}
            </button>
            <button onClick={onClose} className="btn-ghost px-4">
              <IconClose size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
