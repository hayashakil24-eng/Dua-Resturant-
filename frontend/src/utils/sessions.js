import { dateShort, dateLong, time, num } from './format.js'
import { toDayStr } from './closing.js'

// A "session" is the real recording window a report covers: the interval
// between two consecutive day-closings. A business day here routinely spans two
// calendar dates (open 2pm, close 3pm the next day), so scoping a report by
// calendar date splits one session across two reports and hides half the data —
// which is exactly what this module exists to prevent.
//
// A DailyClosing row only stores its END instant (closingTime); there is no
// periodStart column. A session's start is therefore the NEXT-OLDER closing's
// time — the backend derives that into `periodStart` on /api/closings, and the
// fallback here re-derives it from the adjacent row so the UI still works
// against a not-yet-refetched list.
//
// The interval is half-open — (from, to] — matching the `> sinceMs` boundary in
// closing.js's inSession, so a report built here always agrees with the Closing
// page and the Dashboard down to the rupee.

const makeSession = (id, from, to, record) => {
  const fromMs = from ? new Date(from).getTime() : null
  const toMs = to ? new Date(to).getTime() : null
  // No predecessor closing (the very first session, or before the first-ever
  // close): fall back to calendar-day scoping, which is the semantics that
  // report was actually built with — see closing.js inSession's null branch.
  const dayKey = fromMs === null ? toDayStr(to ?? new Date()) : null
  return {
    id,
    from: from ?? null,
    to: to ?? null,
    record: record ?? null,
    open: to == null,
    contains: (d) => {
      if (fromMs === null) return toDayStr(d) === dayKey
      const ms = new Date(d).getTime()
      return ms > fromMs && (toMs === null || ms <= toMs)
    },
  }
}

// → [current, ...closed] newest-first. The first element is always the open
// session, so `sessions[0]` is a safe default and `sessions.slice(1)` is the
// history.
export function buildSessions(dailyClosings = [], lastClosingAt = null) {
  const closed = [...dailyClosings].sort((a, b) => (a.closingTime < b.closingTime ? 1 : -1))
  const past = closed.map((rec, i) =>
    makeSession(rec.id, rec.periodStart ?? closed[i + 1]?.closingTime ?? null, rec.closingTime, rec),
  )
  const openFrom = lastClosingAt ?? closed[0]?.closingTime ?? null
  return [makeSession('current', openFrom, null, null), ...past]
}

// "25 Jul, 02:00 PM → 26 Jul, 03:00 PM". Render it inside dir="ltr" — the
// arrow is direction-neutral, so in Urdu (RTL) the two ends would otherwise
// swap visually and read backwards.
// `t` is optional so the Day Closing page (which is hardcoded English, not
// wired to i18n) can share the same label as the Reports page.
const EN = { now: 'now', upTo: 'Up to', noClosingYet: 'no closing yet' }
export function sessionLabel(session, t) {
  const w = (k) => (t ? t(`reports.${k}`, EN[k]) : EN[k])
  const stamp = (iso) => `${dateShort(iso)}, ${time(iso)}`
  if (!session.from) {
    if (session.open) return `${dateLong()} — ${w('noClosingYet')}`
    return `${w('upTo')} ${stamp(session.to)}`
  }
  return `${stamp(session.from)} → ${session.open ? w('now') : stamp(session.to)}`
}

// "25h 10m" — how long the drawer was recording. Null when there's no start to
// measure from (the pre-first-closing fallback session).
export function sessionDuration(session) {
  if (!session.from) return null
  const ms = (session.to ? new Date(session.to).getTime() : Date.now()) - new Date(session.from).getTime()
  if (ms < 0) return null
  const mins = Math.floor(ms / 60000)
  return `${num(Math.floor(mins / 60))}h ${num(mins % 60)}m`
}
