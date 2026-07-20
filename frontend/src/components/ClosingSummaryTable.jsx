import { time as fmtTime } from '../utils/format.js'

// The CAFÉ ALI daily-closing summary sheet, rendered exactly like the client's
// printed report: a black-bordered black-on-white table. Used both as the
// on-screen preview and inside the print portal (same markup = WYSIWYG), so
// inline styles are intentional (they survive the @media print reset).
// Zero shows as "-" and amounts are grouped without a currency symbol, matching
// the client's sheet.
const fmt = (n) => (Math.round(n || 0) ? Number(Math.round(n)).toLocaleString('en-US') : '-')

function fmtDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  const day = d.toLocaleDateString('en-US', { weekday: 'long' })
  const dd = String(d.getDate()).padStart(2, '0')
  const mon = d.toLocaleDateString('en-US', { month: 'short' })
  const yy = String(d.getFullYear()).slice(2)
  return { day, date: `${dd}/${mon}/${yy}` }
}

export default function ClosingSummaryTable({ report, meta }) {
  if (!report) return null
  const { day, date } = fmtDate(report.date)
  const b = '1px solid #000'
  const cell = { border: b, padding: '7px 12px', fontSize: 14, color: '#000' }
  const amt = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums', width: 170 }

  return (
    <div style={{ background: '#fff', color: '#000', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: b }}>
        <tbody>
          <tr>
            <td colSpan={2} style={{ ...cell, textAlign: 'center', fontWeight: 700, fontSize: 22, letterSpacing: 2 }}>
              CAFÉ ALI
            </td>
          </tr>
          <tr>
            <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{day}</td>
            <td style={{ ...amt, textAlign: 'center', fontWeight: 700 }}>{date}</td>
          </tr>
          <tr>
            <td style={{ ...cell, fontWeight: 700 }}>DESCRIPTION</td>
            <td style={{ ...amt, fontWeight: 700 }}>AMOUNT</td>
          </tr>
          <tr>
            <td style={cell}>GROSS SALE ( ٹوٹل سیل )</td>
            <td style={amt}>{fmt(report.grossSale)}</td>
          </tr>
          <tr>
            <td style={cell}>LESS : DISCOUNT ( ڈسکاؤنٹ )</td>
            <td style={amt}>{fmt(report.discount)}</td>
          </tr>
          <tr>
            <td style={{ ...cell, fontWeight: 700 }}>NET SALE ( سیل )</td>
            <td style={{ ...amt, fontWeight: 700 }}>{fmt(report.netSale)}</td>
          </tr>
          {report.accounts.length === 0 ? (
            <tr>
              <td style={{ ...cell, paddingLeft: 26 }}>ACCOUNT SALES</td>
              <td style={amt}>-</td>
            </tr>
          ) : (
            report.accounts.map((a) => (
              <tr key={a.name}>
                <td style={{ ...cell, paddingLeft: 26 }}>{a.name}</td>
                <td style={amt}>{fmt(a.amount)}</td>
              </tr>
            ))
          )}
          <tr>
            <td style={{ ...cell, fontWeight: 700 }}>NET CASH SALES ( نیٹ کیش سیل )</td>
            <td style={{ ...amt, fontWeight: 700 }}>{fmt(report.netCashSales)}</td>
          </tr>
          <tr>
            <td style={cell}>LESS : EXPENSES ( اخراجات / ایکسپینس )</td>
            <td style={amt}>{fmt(report.expenses)}</td>
          </tr>
          {(report.expensesByCategory || []).map((e) => (
            <tr key={e.category}>
              <td style={{ ...cell, paddingLeft: 26, fontSize: 12, color: '#333' }}>{e.category}</td>
              <td style={{ ...amt, fontSize: 12, color: '#333' }}>{fmt(e.amount)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...cell, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
              REMAINING CASH HAND OVER TO ZAMAN A/C
            </td>
            <td style={{ ...amt, fontWeight: 700, fontSize: 18 }}>{fmt(report.remainingHandover)}</td>
          </tr>
        </tbody>
      </table>
      {meta?.closedBy && (
        <p style={{ fontSize: 11, color: '#333', marginTop: 6, fontFamily: 'Arial, sans-serif' }}>
          Closed by: {meta.closedBy}
          {meta.closedByRole ? ` (${meta.closedByRole})` : ''}
          {meta.closingTime ? ` · ${fmtTime(meta.closingTime)}` : ''}
        </p>
      )}
    </div>
  )
}
