import { createPortal } from 'react-dom'
import { useT } from '../i18n/LanguageContext.jsx'
import { money, dateLong, time } from '../utils/format.js'

// Print-only daily report, laid out for an A4 sheet (not the old 80mm thermal
// slip). Rendered into a <body>-level portal (#printable-daily); the @media
// print rule (body.print-daily) hides the app and shows just this page. Data
// comes from the Reports page's already-computed `report` object, so the printed
// numbers always match the screen.
const Row = ({ label, value, indent, strong, valueColor, divider }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingLeft: indent ? 28 : 0,
      paddingTop: 6,
      paddingBottom: 6,
      fontSize: strong ? 16 : 14,
      fontWeight: strong ? 700 : 400,
      color: '#3E2723',
      borderTop: divider ? '2px solid #E8DCC4' : 'none',
      marginTop: divider ? 4 : 0,
    }}
  >
    <span>{label}</span>
    <span style={{ fontWeight: 700, color: valueColor || '#3E2723', fontSize: strong ? 20 : 14 }}>
      {value}
    </span>
  </div>
)

export default function DailyReportSlip({ report }) {
  const t = useT()
  if (!report) return null

  return createPortal(
    <div
      id="printable-daily"
      aria-hidden="true"
      style={{
        fontFamily: "'Georgia', 'Times New Roman', serif",
        color: '#3E2723',
        background: '#fff',
      }}
    >
      {/* Brand header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 1, color: '#C9A961' }}>
          Cafe Ali
        </div>
        <div style={{ fontSize: 12, color: '#5D4037', marginTop: 2 }}>
          Hawksbay Road, Karachi · 021-111-ALI
        </div>
      </div>

      <div style={{ borderTop: '2px dashed #E8DCC4', margin: '20px 0' }} />

      {/* Title + meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#C9A961', margin: 0 }}>
          {t('reports.dailyReport', 'Daily Report')}
        </h2>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#5D4037' }}>{report.rangeLabel}</span>
      </div>
      <p style={{ fontSize: 12, color: '#8D6E63', marginTop: 4 }}>
        {t('reports.generated', 'Generated')}: {dateLong()} · {time(new Date().toISOString())}
      </p>

      <div style={{ margin: '20px 0' }}>
        <Row label={t('reports.totalOrders', 'Total Orders')} value={report.totalOrders} strong />
        <Row
          label={t(report.revenueLabelKey, 'Total Sale')}
          value={money(report.revenue)}
          strong
          divider
          valueColor="#3498DB"
        />
        {/* Payment-method breakdown */}
        <Row label={`— ${t('reports.cashPayment', 'Cash')}`} value={money(report.cash)} indent />
        <Row label={`— ${t('reports.cardPayment', 'Card')}`} value={money(report.card)} indent />
        <Row label={`— ${t('reports.onlinePayment', 'Online')}`} value={money(report.online)} indent />
        {/* Per-account online reconciliation — which wallet/bank each online
            payment landed in, so the totals can be matched against statements. */}
        {(report.onlineByAccount || []).map(([name, amount]) => (
          <div
            key={name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              paddingLeft: 48,
              paddingTop: 3,
              paddingBottom: 3,
              fontSize: 12,
              color: '#5D4037',
            }}
          >
            <span>· {name}</span>
            <span style={{ fontWeight: 700 }}>{money(amount)}</span>
          </div>
        ))}
        <Row
          label={t('reports.expenses', 'Expenses')}
          value={money(report.expenses)}
          strong
          divider
          valueColor="#E74C3C"
        />
        <Row
          label={t('reports.netProfit', 'Net Profit')}
          value={money(report.netProfit)}
          strong
          divider
          valueColor={report.netProfit >= 0 ? '#27AE60' : '#E74C3C'}
        />
      </div>

      <div style={{ borderTop: '2px dashed #E8DCC4', margin: '24px 0 12px' }} />
      <p style={{ textAlign: 'center', fontSize: 12, color: '#8D6E63' }}>
        {t('reports.footer', 'Thank you!')}
      </p>
    </div>,
    document.body,
  )
}
