// Recipe approval status pill — matches the app's `badge ring-1` style used by
// StatusBadge/PaymentBadge so recipes read consistently wherever they're listed.
const STYLES = {
  approved: 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/30',
  pending: 'bg-amber-500/12 text-amber-300 ring-amber-500/30',
  rejected: 'bg-rose-500/12 text-rose-300 ring-rose-500/30',
}

import { useT } from '../i18n/LanguageContext.jsx'

const LABEL_KEY = {
  approved: 'kitchen.statusApproved',
  pending: 'kitchen.statusPending',
  rejected: 'kitchen.statusRejected',
}

export default function RecipeStatusBadge({ status }) {
  const t = useT()
  if (!LABEL_KEY[status]) return null
  return <span className={`badge ring-1 ${STYLES[status]}`}>{t(LABEL_KEY[status])}</span>
}
