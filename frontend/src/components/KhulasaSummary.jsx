import { Fragment } from 'react'
import { categoryLabel, itemNameLabel, unitLabel } from '../i18n/dataDict.js'

// "خلاصہ" (Khulasa/Summary) — a second, consolidated bilingual sheet on the Day
// Closing page, alongside (not replacing) ClosingSummaryTable's plain
// black-bordered cash-reconciliation sheet. Deliberately does NOT use the
// app's usual gold/brown Cafe Ali branding — this is its own cream/beige/grey
// palette per the client's reference design, always rendered in this fixed
// bilingual format regardless of the app's active language toggle (same
// principle ClosingSummaryTable already follows for its own hardcoded-English
// sheet). All colors/borders are inline styles for the same reason that file
// documents: they must survive the @media print reset.
const GOLD = '#B8860B'
const HILITE_BG = '#F5EFE0'
const BAND_BG = '#EDE6D6'
const BORDER = '#E0E0E0'
const TEXT = '#222'
const MUTED = '#777'

const fmt = (n) => (Math.round(n || 0) ? Number(Math.round(n)).toLocaleString('en-US') : '-')

// buildClosingReport's `accounts` array always uses this literal English
// string for the card total (it's app-generated, not user-typed) — every
// other account name is free text (an admin-configured online/Udhaar account
// name) and is left exactly as entered, whatever script it was typed in.
const accountLabel = (name) => (name === 'Card Account' ? 'کارڈ اکاؤنٹ' : name)

const DAY_NAMES_UR = {
  Sunday: 'اتوار',
  Monday: 'پیر',
  Tuesday: 'منگل',
  Wednesday: 'بدھ',
  Thursday: 'جمعرات',
  Friday: 'جمعہ',
  Saturday: 'ہفتہ',
}

// "23-07-2026 — جمعرات" — Latin-digit DD-MM-YYYY, always (not locale-driven),
// plus the Urdu weekday name.
function khulasaDateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const dayEn = d.toLocaleDateString('en-US', { weekday: 'long' })
  return `${dd}-${mm}-${yyyy} — ${DAY_NAMES_UR[dayEn] || dayEn}`
}

const cellBase = { border: `1px solid ${BORDER}`, padding: '9px 14px', fontSize: 14, color: TEXT, background: '#fff' }

// One label/amount row of the main table and the two side tables — dir="rtl"
// puts the first DOM child (label) on the visual right and the second
// (amount) on the visual left, matching the reference image without any
// manual flex/grid reversal.
function Row({ label, amount, highlight }) {
  const cell = { ...cellBase, ...(highlight ? { background: HILITE_BG, fontWeight: 700 } : {}) }
  return (
    <tr dir="rtl">
      <td style={cell}>{label}</td>
      <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(amount)}</td>
    </tr>
  )
}

// A titled sub-table (Accounts / Pending Bill) — a single band-title row
// (no separate column headers), data rows, then a highlighted total row.
function SideTable({ title, rows, total }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        <tr>
          <td colSpan={2} style={{ ...cellBase, background: BAND_BG, fontWeight: 700, textAlign: 'center' }}>
            {title}
          </td>
        </tr>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={2} style={{ ...cellBase, textAlign: 'center', color: MUTED }}>
              -
            </td>
          </tr>
        ) : (
          rows.map((r, i) => <Row key={i} label={r.label} amount={r.amount} />)
        )}
        <Row label="ٹوٹل" amount={total} highlight />
      </tbody>
    </table>
  )
}

// Groups a flat expenseTransactions list into per-category buckets — each
// row itemized (vendor if set, else description), a subtotal per category,
// then an overall total. Client's Excel ledger lists every purchase/labour
// line individually under its bucket (e.g. every Maintenance vendor paid,
// every Purchasing item bought), not just one lump category total.
function groupExpensesByCategory(expenseTransactions) {
  const byCategory = new Map()
  for (const tx of expenseTransactions) {
    if (!byCategory.has(tx.category)) byCategory.set(tx.category, [])
    byCategory.get(tx.category).push(tx)
  }
  return Array.from(byCategory, ([category, items]) => ({
    category,
    label: categoryLabel(category, 'ur'),
    items,
    subtotal: items.reduce((s, i) => s + i.amount, 0),
  })).sort((a, b) => b.subtotal - a.subtotal)
}

// "اخراجات کی قسم" (Expenses by Type) — itemized by category: a band header
// per category, its rows (vendor/description + amount), a subtotal row, then
// an overall total row at the very bottom.
function ItemizedExpensesTable({ title, groups, total }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        <tr>
          <td colSpan={2} style={{ ...cellBase, background: BAND_BG, fontWeight: 700, textAlign: 'center' }}>
            {title}
          </td>
        </tr>
        {groups.length === 0 ? (
          <tr>
            <td colSpan={2} style={{ ...cellBase, textAlign: 'center', color: MUTED }}>
              -
            </td>
          </tr>
        ) : (
          groups.map((g) => (
            <Fragment key={g.category}>
              <tr dir="rtl">
                <td colSpan={2} style={{ ...cellBase, fontWeight: 700, fontSize: 12.5 }}>
                  {g.label}
                </td>
              </tr>
              {g.items.map((it, i) => (
                <Row key={i} label={it.vendor || it.description || '-'} amount={it.amount} />
              ))}
              <Row label={`${g.label} — ٹوٹل`} amount={g.subtotal} />
            </Fragment>
          ))
        )}
        <Row label="ٹوٹل" amount={total} highlight />
      </tbody>
    </table>
  )
}

export default function KhulasaSummary({ report, meta }) {
  if (!report) return null
  const accounts = report.accounts || []
  const discountBreakdown = report.discountBreakdown || []
  const inventoryUsed = report.inventoryUsed || []
  const expenseGroups = groupExpensesByCategory(report.expenseTransactions || [])
  const accountsTotal = accounts.reduce((s, a) => s + a.amount, 0)
  const discountTotal = discountBreakdown.reduce((s, d) => s + d.amount, 0)
  // This session's Udhaar charges by named customer ("پینڈنگ بل" — money
  // owed BY customers, distinct from `accounts` which mixes online/card/
  // Udhaar together for the cash-reconciliation math above).
  const pendingBills = report.udhaarByAccount || []
  const pendingBillsTotal = pendingBills.reduce((s, [, amount]) => s + amount, 0)

  return (
    <div style={{ background: '#fff', color: TEXT, fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2, color: TEXT }}>CAFÉ ALI</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: GOLD, marginTop: 6 }}>خلاصہ</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }} dir="ltr">
          {khulasaDateLabel(report.date)}
        </div>
      </div>
      <div style={{ borderTop: `2px solid ${GOLD}`, margin: '14px 0' }} />

      {/* Main Sales-to-Cash table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <tbody>
          <Row label="ٹوٹل سیل" amount={report.grossSale} />
          <Row label="کم: ڈسکاؤنٹ" amount={report.discount} />
          <Row label="نیٹ سیل" amount={report.netSale} highlight />
          {accounts.map((a, i) => (
            <Row key={i} label={accountLabel(a.name)} amount={a.amount} />
          ))}
          <Row label="نیٹ کیش سیل" amount={report.netCashSales} highlight />
          <Row label="کم: اخراجات" amount={report.expenses} />
          <Row label="باقی نقد رقم" amount={report.remainingHandover} highlight />
        </tbody>
      </table>

      {/* Expenses by Type / Accounts — side by side. Explicit inline grid, not
          a Tailwind md: breakpoint class — this renders inside a fixed-width
          print portal, not the normal responsive viewport. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <ItemizedExpensesTable title="اخراجات کی قسم" groups={expenseGroups} total={report.expenses} />
        <SideTable
          title="اکاؤنٹس"
          rows={accounts.map((a) => ({ label: accountLabel(a.name), amount: a.amount }))}
          total={accountsTotal}
        />
      </div>

      {/* پینڈنگ بل — this session's Udhaar charges by named customer (money
          owed BY customers), separate from the Accounts reconciliation above. */}
      <div style={{ marginBottom: 20 }}>
        <SideTable
          title="پینڈنگ بل"
          rows={pendingBills.map(([name, amount]) => ({ label: name, amount }))}
          total={pendingBillsTotal}
        />
      </div>

      {/* Discount Approvals — a real 4-column header row (unlike the two
          single-band-title tables above). DOM order [table, amount, reason,
          by] under dir="rtl" puts میز rightmost/first-read, منظوری leftmost. */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <tbody>
          <tr dir="rtl">
            {['میز', 'رقم', 'وجہ', 'منظوری'].map((h) => (
              <td key={h} style={{ ...cellBase, background: BAND_BG, fontWeight: 700, textAlign: 'center' }}>
                {h}
              </td>
            ))}
          </tr>
          {discountBreakdown.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ ...cellBase, textAlign: 'center', color: MUTED }}>
                -
              </td>
            </tr>
          ) : (
            discountBreakdown.map((d, i) => (
              <tr key={i} dir="rtl">
                <td style={{ ...cellBase, textAlign: 'center' }}>{d.table ?? '-'}</td>
                <td style={{ ...cellBase, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{fmt(d.amount)}</td>
                <td style={cellBase}>{d.reason || '-'}</td>
                <td style={cellBase}>{d.by || '-'}</td>
              </tr>
            ))
          )}
          <tr dir="rtl">
            <td colSpan={3} style={{ ...cellBase, background: HILITE_BG, fontWeight: 700 }}>
              ٹوٹل ڈسکاؤنٹ
            </td>
            <td style={{ ...cellBase, background: HILITE_BG, fontWeight: 700, textAlign: 'center' }}>{fmt(discountTotal)}</td>
          </tr>
        </tbody>
      </table>

      {/* Stock Used Today — single band-title row, name (right) / qty+unit
          (left) under dir="rtl", no total row. */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td colSpan={2} style={{ ...cellBase, background: BAND_BG, fontWeight: 700, textAlign: 'center' }}>
              آج استعمال ہونے والا اسٹاک
            </td>
          </tr>
          {inventoryUsed.length === 0 ? (
            <tr>
              <td colSpan={2} style={{ ...cellBase, textAlign: 'center', color: MUTED }}>
                -
              </td>
            </tr>
          ) : (
            inventoryUsed.map((it, i) => (
              <tr key={i} dir="rtl">
                <td style={cellBase}>{itemNameLabel(it.name, 'ur')}</td>
                <td style={{ ...cellBase, textAlign: 'right' }}>
                  {it.qty} {unitLabel(it.unit, 'ur')}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ fontSize: 11, color: MUTED, textAlign: 'center' }}>
        <p>
          آرڈرز: {report.totalOrders} (منسوخ شدہ: {report.cancelledOrders}) • جی ایس ٹی وصول شدہ: {fmt(report.gstCollected)}
        </p>
        {meta?.closedBy && (
          <p style={{ marginTop: 2 }}>
            تیار کردہ: {meta.closedBy}
            {meta.closedByRole ? ` (${meta.closedByRole})` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
