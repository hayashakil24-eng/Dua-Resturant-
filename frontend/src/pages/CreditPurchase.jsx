import { Fragment, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/LanguageContext.jsx'
import { PageHeader, StatCard } from '../components/ui.jsx'
import { money, dateShort } from '../utils/format.js'
import SettlePayableModal from '../components/SettlePayableModal.jsx'
import { IconWallet, IconCheck, IconChevronDown } from '../components/Icons.jsx'

// Mirror-image of ReceivablesManagement.jsx (money the cafe owes suppliers,
// rather than money owed to the cafe) — same stat-card + expandable-table +
// Settle-modal layout, moved here from the card that used to sit at the
// bottom of Inventory.jsx so supplier debt lives in Finance alongside
// Accounting/Receivables/Handovers/Billing, not under the stock table.
const CREDIT_PURCHASE_PAGE_SIZE = 20

export default function CreditPurchase() {
  const { payables, purchases, recordPayablePayment, canSettlePayables } = useApp()
  const t = useT()
  // Payable.purchases[].purchaseId → the actual StockPurchase row, so a
  // breakdown line can show what was bought instead of just an amount.
  const purchaseById = useMemo(() => new Map(purchases.map((p) => [p.id, p])), [purchases])

  const [showAll, setShowAll] = useState(false)
  const [visibleCount, setVisibleCount] = useState(CREDIT_PURCHASE_PAGE_SIZE)
  const [settleTarget, setSettleTarget] = useState(null)
  // Which supplier rows are expanded to show their purchase-by-purchase
  // breakdown (charges — the credit purchases that built up the balance —
  // and payments/settlements against it), same convention as Receivables.
  const [expanded, setExpanded] = useState(() => new Set())
  const toggleExpanded = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const rows = useMemo(
    () => (showAll ? payables : payables.filter((p) => p.status === 'open')),
    [payables, showAll],
  )
  const shown = rows.slice(0, visibleCount)

  // Everything ever bought on credit, paid off or not — the ledger total,
  // distinct from the currently-open balance shown per row below.
  const creditPurchasesTotal = useMemo(
    () => purchases.filter((p) => p.paymentStatus !== 'paid').reduce((s, p) => s + p.totalCost, 0),
    [purchases],
  )
  // Everything ever paid back to suppliers (settlement audit total).
  const settledTotal = useMemo(
    () => payables.reduce((s, p) => s + (p.payments || []).reduce((a, x) => a + x.amount, 0), 0),
    [payables],
  )
  // Recent settlement/payment entries for the on-page audit list.
  const recentPayments = useMemo(
    () =>
      payables
        .flatMap((p) => (p.payments || []).map((x) => ({ ...x, account: p.name })))
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, 8),
    [payables],
  )

  return (
    <div>
      <PageHeader title={t('creditPurchase.title')} subtitle={t('creditPurchase.subtitle')}>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-cream-dim">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => {
                setShowAll(e.target.checked)
                setVisibleCount(CREDIT_PURCHASE_PAGE_SIZE)
              }}
              className="h-4 w-4 accent-gold"
            />
            {t('creditPurchase.showAll')}
          </label>
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard icon={IconWallet} label={t('creditPurchase.creditPurchases')} value={money(creditPurchasesTotal)} sub={t('creditPurchase.allTime')} />
        <StatCard icon={IconCheck} label={t('creditPurchase.settledTotal')} value={money(settledTotal)} sub={t('creditPurchase.allTime')} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-line text-xs uppercase tracking-wider text-cream-dim">
                <th className="w-8 px-2 py-4" />
                <th className="px-5 py-4 font-semibold">{t('creditPurchase.colSupplier')}</th>
                <th className="px-5 py-4 text-right font-semibold">{t('creditPurchase.colBalance')}</th>
                <th className="px-5 py-4 text-center font-semibold">{t('creditPurchase.colStatus')}</th>
                <th className="px-5 py-4 text-right font-semibold">{t('creditPurchase.colAction')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-line">
              {shown.map((p) => {
                const open = p.status === 'open'
                const isOpen = expanded.has(p.id)
                // Purchases (credit buys that built up the balance) and
                // payments (settlements against it) shown together, newest
                // first, so a payment shows inline too, not only in the
                // settlement audit list further down the page.
                const entries = [
                  ...(p.purchases || []).map((c) => ({ ...c, kind: 'purchase' })),
                  ...(p.payments || []).map((x) => ({ ...x, kind: 'payment' })),
                ].sort((a, b) => new Date(b.at) - new Date(a.at))
                return (
                  <Fragment key={p.id}>
                    <tr
                      className="cursor-pointer transition hover:bg-white/[0.02]"
                      onClick={() => toggleExpanded(p.id)}
                    >
                      <td className="px-2 py-4 text-cream-dim">
                        <IconChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-cream">{p.name}</p>
                        {p.notes && <p className="text-xs text-cream-dim">{p.notes}</p>}
                      </td>
                      <td className={`px-5 py-4 text-right font-semibold ${open ? 'text-rose-300' : 'text-emerald-300'}`}>
                        {money(p.balance)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`badge ring-1 ${
                            open
                              ? 'bg-rose-500/12 text-rose-300 ring-rose-500/30'
                              : 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/30'
                          }`}
                        >
                          {open ? t('creditPurchase.statusOpen') : t('creditPurchase.statusSettled')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {open && canSettlePayables() && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSettleTarget(p)
                            }}
                            className="btn-gold px-3 py-1.5 text-xs font-bold"
                          >
                            {t('payables.settle')}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${p.id}-breakdown`}>
                        <td colSpan={5} className="bg-ink-soft/40 px-5 py-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-cream-dim">
                            {t('creditPurchase.breakdown')}
                          </p>
                          {entries.length === 0 ? (
                            <p className="text-xs text-cream-dim">{t('creditPurchase.noEntries')}</p>
                          ) : (
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="text-cream-dim">
                                  <th className="py-1.5 pe-4 font-semibold">{t('creditPurchase.colDate')}</th>
                                  <th className="py-1.5 pe-4 font-semibold">{t('creditPurchase.colDetail')}</th>
                                  <th className="py-1.5 pe-4 font-semibold">{t('receivables.colBy')}</th>
                                  <th className="py-1.5 text-right font-semibold">{t('receivables.colAmount')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-ink-line/60">
                                {entries.map((e) => {
                                  if (e.kind === 'payment') {
                                    return (
                                      <tr key={e.id}>
                                        <td className="py-1.5 pe-4 text-cream-dim">{dateShort(e.at)}</td>
                                        <td className="py-1.5 pe-4 text-cream-dim">
                                          {t('creditPurchase.paymentVia', 'Payment')} {e.method ? `· ${e.method}` : ''}
                                          {e.notes ? ` · ${e.notes}` : ''}
                                        </td>
                                        <td className="py-1.5 pe-4 text-cream-dim">{e.by || '—'}</td>
                                        <td className="py-1.5 text-right font-semibold text-emerald-300">{money(e.amount)}</td>
                                      </tr>
                                    )
                                  }
                                  const purchase = e.purchaseId ? purchaseById.get(e.purchaseId) : null
                                  const detail = purchase ? `${purchase.itemName} — ${purchase.quantity} ${purchase.unit}` : '—'
                                  return (
                                    <tr key={e.id}>
                                      <td className="py-1.5 pe-4 text-cream-dim">{dateShort(e.at)}</td>
                                      <td className="py-1.5 pe-4 text-cream-dim">{detail}</td>
                                      <td className="py-1.5 pe-4 text-cream-dim">{e.by || '—'}</td>
                                      <td className="py-1.5 text-right font-semibold text-rose-300">{money(e.amount)}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="p-10 text-center text-sm text-cream-dim">
            {showAll ? t('creditPurchase.none') : t('creditPurchase.noOpen')}
          </div>
        )}
        {shown.length < rows.length && (
          <div className="flex items-center justify-center border-t border-ink-line p-4">
            <button
              onClick={() => setVisibleCount((c) => c + CREDIT_PURCHASE_PAGE_SIZE)}
              className="btn-ghost px-5 py-2 text-sm"
            >
              {t('receivables.loadMore', 'Load more')} · {shown.length}/{rows.length}
            </button>
          </div>
        )}
      </div>

      {/* On-page settlement audit trail */}
      {recentPayments.length > 0 && (
        <div className="card mt-6 p-6">
          <div className="mb-4 flex items-center gap-2">
            <IconWallet size={18} className="text-gold" />
            <h2 className="font-serif text-xl text-cream">{t('creditPurchase.settledTotal')}</h2>
          </div>
          <div className="space-y-2">
            {recentPayments.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-line bg-ink-soft/50 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium text-cream">{p.account}</span>
                  <span className="text-cream-dim"> · {p.method}</span>
                  {p.notes && <span className="text-cream-dim"> · {p.notes}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-emerald-300">{money(p.amount)}</span>
                  <span className="text-xs text-cream-dim">{p.by} · {dateShort(p.at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {settleTarget && (
        <SettlePayableModal
          payable={settleTarget}
          onClose={() => setSettleTarget(null)}
          onConfirm={async (data) => {
            const res = await recordPayablePayment(settleTarget.id, data.amount, data)
            if (res?.error) return
            setSettleTarget(null)
          }}
        />
      )}
    </div>
  )
}
