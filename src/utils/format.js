import { CURRENCY } from '../data/mockData.js'

export const money = (n) =>
  `${CURRENCY} ${Number(n || 0).toLocaleString('en-PK')}`

export const time = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export const dateLong = (iso = new Date().toISOString()) =>
  new Date(iso).toLocaleDateString('en-PK', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
