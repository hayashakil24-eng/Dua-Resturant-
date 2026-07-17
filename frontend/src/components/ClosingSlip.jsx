import { createPortal } from 'react-dom'
import ClosingSummaryTable from './ClosingSummaryTable.jsx'

// Print-only wrapper for the closing summary sheet. Rendered into a <body>-level
// portal (#printable-closing); the @media print rule (body.print-closing) hides
// the app and shows just this sheet. Same table markup as the on-screen preview.
export default function ClosingSlip({ report, meta }) {
  if (!report) return null
  return createPortal(
    <div id="printable-closing" aria-hidden="true" style={{ background: '#fff' }}>
      <ClosingSummaryTable report={report} meta={meta} />
    </div>,
    document.body,
  )
}
