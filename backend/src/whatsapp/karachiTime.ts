// The VPS is not necessarily hosted in Pakistan (this deployment runs on a
// Contabo box in Europe/Berlin) — every WhatsApp-facing clock time must be
// computed in the restaurant's own timezone, never the host process's local
// system timezone. `Date.prototype.getHours()`/`getMinutes()` read whatever
// TZ the Node process happens to be running under, which silently drifted a
// closing saved at ~07:20 Pakistan time into a reply showing "4:18 صبح" (the
// VPS's own Berlin-local clock at render time) — confirmed live. Bare
// "YYYY-MM-DD" date strings (dayNameFor/dateLabelUr in report.ts) don't have
// this problem — they're already the correct calendar date at the point
// they're saved (by the on-site local server, which genuinely does run in
// Pakistan) and are just round-tripped through Date for weekday/formatting,
// never re-derived from an instant — only actual instants (DailyClosing's
// closingTime, periodStart/periodEnd) need this helper.
const TIMEZONE = 'Asia/Karachi'

export function karachiHourMinute(d: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  // Intl can emit "24" for midnight with hour12:false depending on engine.
  const hour = get('hour') % 24
  return { hour, minute: get('minute') }
}

export function karachiDateParts(d: Date): { year: number; month: number; date: number; hour: number; minute: number } {
  const { hour, minute } = karachiHourMinute(d)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return { year: get('year'), month: get('month'), date: get('day'), hour, minute }
}
