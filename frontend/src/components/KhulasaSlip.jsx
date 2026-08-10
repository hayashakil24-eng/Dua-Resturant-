import { createPortal } from 'react-dom'
import KhulasaSummary from './KhulasaSummary.jsx'

// Print-only wrapper for the Khulasa sheet — exact mirror of ClosingSlip.jsx.
// Rendered into a <body>-level portal (#printable-khulasa); the @media print
// rule (body.print-khulasa) hides the app and shows just this sheet.
export default function KhulasaSlip({ report, meta }) {
  if (!report) return null
  return createPortal(
    <div id="printable-khulasa" aria-hidden="true" style={{ background: '#fff' }}>
      <KhulasaSummary report={report} meta={meta} />
    </div>,
    document.body,
  )
}
