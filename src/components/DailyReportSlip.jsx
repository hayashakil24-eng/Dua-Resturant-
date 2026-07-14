import { createPortal } from 'react-dom'
import { useT } from '../i18n/LanguageContext.jsx'
import { money, clock } from '../utils/format.js'

// Minimal, print-only daily-report slip (8 key figures). Rendered into a
// <body>-level portal (#printable-daily); the @media print rule (body.print-daily)
// hides the app and shows just this slip. Data comes from the Reports page's
// already-computed `report` object, so the numbers always match the screen.
const Row = ({ label, value, indent, strong, valueColor }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      paddingLeft: indent ? 14 : 0,
      fontSize: strong ? 14 : 13,
      fontWeight: strong ? 700 : 400,
      lineHeight: 1.9,
    }}
  >
    <span>{label}</span>
    <span style={{ fontWeight: 700, color: valueColor || '#000' }}>{value}</span>
  </div>
)

export default function DailyReportSlip({ report }) {
  const t = useT()
  if (!report) return null

  return createPortal(
    <div
      id="printable-daily"
      aria-hidden="true"
      style={{ fontFamily: "'Courier New', monospace", color: '#000', background: '#fff' }}
    >
      <div style={{ width: '80mm', margin: '0 auto', padding: '6mm 4mm' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>CAFÉ ALI</div>
          <div style={{ fontSize: 11 }}>Hawksbay Road, Karachi</div>
          <div style={{ fontSize: 11 }}>021-111-ALI</div>
        </div>

        <div style={{ borderTop: '2px solid #000', margin: '8px 0' }} />

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 2, fontSize: 15, fontWeight: 700 }}>
          {t('reports.dailyReport', 'DAILY REPORT').toUpperCase()}
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{report.rangeLabel}</div>
        <div style={{ textAlign: 'center', fontSize: 11, marginBottom: 8 }}>
          {t('reports.generated', 'Generated')}: {clock()}
        </div>

        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

        {/* Figures */}
        <Row label={t('reports.totalOrders', 'Total Orders')} value={report.totalOrders} strong />
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
        <Row
          label={t(report.revenueLabelKey, 'Total Sale')}
          value={money(report.revenue)}
          strong
        />
        <Row label={`— ${t('reports.cashPayment', 'Cash')}`} value={money(report.cash)} indent />
        <Row label={`— ${t('reports.cardPayment', 'Card')}`} value={money(report.card)} indent />
        <Row label={`— ${t('reports.onlinePayment', 'Online')}`} value={money(report.online)} indent />
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
        <Row label={t('reports.expenses', 'Expenses')} value={money(report.expenses)} strong />
        <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
        <Row label={t('reports.netProfit', 'Net Profit')} value={money(report.netProfit)} strong />

        <div style={{ borderTop: '1px dashed #000', margin: '10px 0 8px' }} />
        <div style={{ textAlign: 'center', fontSize: 11 }}>Thank You!</div>
      </div>
    </div>,
    document.body,
  )
}
