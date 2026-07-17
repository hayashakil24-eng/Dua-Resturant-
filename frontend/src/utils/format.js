import { CURRENCY } from '../data/mockData.js'

// Locale-aware formatting. When the app language is Urdu we switch to the
// Pakistani Urdu locale with the Eastern-Arabic ("arabext") numbering system so
// numbers, dates and times render in Urdu digits (۱۲۵۰), Urdu month names
// (جولائی) and Urdu day-periods (صبح/شام). English/Latin otherwise.
//
// The language is read from localStorage (written synchronously by
// LanguageContext) so these plain functions stay in sync during render without
// needing React context. Table labels (A1, HUT1) are strings, not numbers, so
// they're untouched by design.
const isUrdu = () => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('lang') === 'ur'
  } catch {
    return false
  }
}

const UR = 'ur-PK-u-nu-arabext'
const numLocale = () => (isUrdu() ? UR : 'en-PK')

export const money = (n) => `${CURRENCY} ${Number(n || 0).toLocaleString(numLocale())}`

export const time = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isUrdu()) {
    // Intl leaves the day-period as English "AM/PM" for ur in most engines, so
    // build the 12-hour clock manually with Urdu digits + صبح/شام.
    const period = d.getHours() >= 12 ? 'شام' : 'صبح'
    const h12 = d.getHours() % 12 || 12
    const two = new Intl.NumberFormat(UR, { minimumIntegerDigits: 2, useGrouping: false })
    return `${two.format(h12)}:${two.format(d.getMinutes())} ${period}`
  }
  return d.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export const dateShort = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(numLocale(), {
    day: '2-digit',
    month: 'short',
  })
}

export const dateLong = (iso = new Date().toISOString()) =>
  new Date(iso).toLocaleDateString(numLocale(), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

// "July 2026" / "جولائی ۲۰۲۶" — month picker labels.
export const monthYear = (date) =>
  new Date(date).toLocaleDateString(numLocale(), { month: 'long', year: 'numeric' })

// "July" / "جولائی" — month name only.
export const monthName = (date) =>
  new Date(date).toLocaleDateString(numLocale(), { month: 'long' })

// "Mon, 12 Jul" / "پیر، ۱۲ جولائی" — compact weekday label (Dashboard clock).
export const dayShort = (date) =>
  new Date(date).toLocaleDateString(numLocale(), { weekday: 'short', day: 'numeric', month: 'short' })

// Live clock with seconds (Dashboard header). Urdu digits + صبح/شام.
export const clock = (date) => {
  const d = new Date(date)
  if (isUrdu()) {
    const period = d.getHours() >= 12 ? 'شام' : 'صبح'
    const h12 = d.getHours() % 12 || 12
    const two = new Intl.NumberFormat(UR, { minimumIntegerDigits: 2, useGrouping: false })
    return `${two.format(h12)}:${two.format(d.getMinutes())}:${two.format(d.getSeconds())} ${period}`
  }
  return d.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}
