// Shared by both send paths (schedule.ts's automated daily send, and
// vps/app.ts's on-demand webhook reply) — "render a saved closing and send
// it to someone." The only difference between the two paths is what
// triggers the call and which database it runs against (the local server's
// own DB for the schedule; the VPS's synced copy for the webhook) — the
// prisma import is the shared singleton either way, pointed wherever this
// process's DATABASE_URL says.

import { prisma } from '../db/client.js'
import { getLatestClosing } from '../services/closing.service.js'
import {
  renderSummarySection,
  renderLedgersSection,
  renderCancelledSection,
  renderComplimentarySection,
} from '../reports/whatsappReport.js'
import { sendReportImage } from './client.js'
import type { ClosingReport } from '../core/closing.js'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_NAMES_UR: Record<string, string> = {
  Sunday: 'اتوار',
  Monday: 'پیر',
  Tuesday: 'منگل',
  Wednesday: 'بدھ',
  Thursday: 'جمعرات',
  Friday: 'جمعہ',
  Saturday: 'ہفتہ',
}

function dayNameFor(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '' : DAY_NAMES[d.getDay()]!
}

export function dayNameUrFor(dateStr: string): string {
  return DAY_NAMES_UR[dayNameFor(dateStr)] ?? ''
}

const MONTHS_UR = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر']

// "22 جولائی 2026" — deliberately NOT the raw "YYYY-MM-DD" `date` string.
// WhatsApp's own client auto-detects ISO-looking dates and renders them as a
// highlighted, tappable green chip (what made the old closing-picker menu
// look broken — every line was just that chip, styling WhatsApp itself
// injected, not something in our message text). A month-name date isn't
// pattern-matched by that detector. Digits stay Latin, matching the client's
// own real reports (whatsappReport.ts's top comment).
export function dateLabelUr(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return `${d.getDate()} ${MONTHS_UR[d.getMonth()]} ${d.getFullYear()}`
}

// "6:05 شام" — same صبح/شام (morning/evening) 12-hour convention as the
// frontend's format.js `time()`, Latin digits (see dateLabelUr above for why).
export function timeLabelUr(iso: string | Date): string {
  const d = new Date(iso)
  const period = d.getHours() >= 12 ? 'شام' : 'صبح'
  const h12 = d.getHours() % 12 || 12
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${h12}:${mm} ${period}`
}

export interface LoadedClosing {
  id: string
  report: ClosingReport
  dayNameUr: string
}

// Client feedback on the WhatsApp report: wants account names in Urdu too,
// not just section headers. OnlineAccount.nameUrdu (optional, same pattern
// as Department.nameUrdu) is a live lookup here, not baked into the saved
// ClosingReport JSON — the report's `accounts[].name` is also read by the
// admin-facing Closing page (English), so the substitution has to happen
// only on this WhatsApp-specific path, not at the source. A renamed/
// deleted account after the fact just falls back to whatever's in the
// saved report — display-label drift is an acceptable simplification for
// a cosmetic field, unlike the financial snapshot fields.
async function withAccountUrduNames(report: ClosingReport): Promise<ClosingReport> {
  if (report.accounts.length === 0) return report
  const accounts = await prisma.onlineAccount.findMany({ where: { nameUrdu: { not: null } }, select: { name: true, nameUrdu: true } })
  if (accounts.length === 0) return report
  const urduByName = new Map(accounts.map((a) => [a.name, a.nameUrdu!]))
  return { ...report, accounts: report.accounts.map((a) => ({ ...a, name: urduByName.get(a.name) ?? a.name })) }
}

function parseClosing(row: { id: string; date: string; reportJson: string }): LoadedClosing | null {
  try {
    return { id: row.id, report: JSON.parse(row.reportJson) as ClosingReport, dayNameUr: dayNameUrFor(row.date) }
  } catch {
    return null
  }
}

// Null if nothing has ever been closed, or the saved record is corrupt.
export async function loadLatestClosing(): Promise<LoadedClosing | null> {
  const latest = await getLatestClosing()
  if (!latest) return null
  const loaded = parseClosing(latest)
  if (!loaded) return null
  return { ...loaded, report: await withAccountUrduNames(loaded.report) }
}

export async function loadClosingById(id: string): Promise<LoadedClosing | null> {
  const row = await prisma.dailyClosing.findUnique({ where: { id } })
  if (!row) return null
  const loaded = parseClosing(row)
  if (!loaded) return null
  return { ...loaded, report: await withAccountUrduNames(loaded.report) }
}

export interface ClosingMenuItem {
  id: string
  closingTime: string // ISO
}

export interface ClosingDayGroup {
  date: string
  dayNameUr: string
  closings: ClosingMenuItem[] // chronological within the day (oldest first)
}

// Client feedback (requirements.md §7's "admin can request a report by
// messaging the system directly"): wants the picker grouped by calendar day
// (heading) with each closing under it shown by time, and wants the last 7
// DAYS, not the last 7 closing RECORDS — closing is per-session, not
// per-day (core/closing.ts), so multiple closings can share one calendar
// date, and a flat "last 7 rows" cap could otherwise show only one day
// repeated 7 times (exactly what happened during testing on 2026-07-22).
const RECENT_DAYS_LIMIT = 7

export async function listRecentClosingDays(): Promise<ClosingDayGroup[]> {
  const recentDates = await prisma.dailyClosing.groupBy({
    by: ['date'],
    orderBy: { date: 'desc' },
    take: RECENT_DAYS_LIMIT,
  })
  const dates = recentDates.map((d) => d.date)
  if (dates.length === 0) return []
  const rows = await prisma.dailyClosing.findMany({
    where: { date: { in: dates } },
    orderBy: { closingTime: 'asc' },
    select: { id: true, date: true, closingTime: true },
  })
  const closingsByDate = new Map<string, ClosingMenuItem[]>()
  for (const r of rows) {
    const list = closingsByDate.get(r.date) ?? []
    list.push({ id: r.id, closingTime: r.closingTime.toISOString() })
    closingsByDate.set(r.date, list)
  }
  return dates.map((date) => ({ date, dayNameUr: dayNameUrFor(date), closings: closingsByDate.get(date) ?? [] }))
}

// One "report type" within a closing — mirrors the four sections
// whatsappReport.ts can render independently. 'all' sends every non-empty
// section as its own image (an album), same as the client's own habit of
// sending several separate photos for one day's closing.
export type ReportSection = 'summary' | 'ledgers' | 'cancelled' | 'complimentary' | 'all'

const SECTION_RENDERERS: Record<Exclude<ReportSection, 'all'>, (report: ClosingReport, dayNameUr: string) => Promise<Buffer | null>> = {
  summary: renderSummarySection,
  ledgers: renderLedgersSection,
  cancelled: renderCancelledSection,
  complimentary: renderComplimentarySection,
}

const SECTION_CAPTION: Record<Exclude<ReportSection, 'all'>, string> = {
  summary: 'خلاصہ',
  ledgers: 'اکاؤنٹ لیجرز',
  cancelled: 'کینسل بل',
  complimentary: 'آفشل بل',
}

async function sendSection(recipient: string, loaded: LoadedClosing, section: Exclude<ReportSection, 'all'>): Promise<boolean> {
  const png = await SECTION_RENDERERS[section](loaded.report, loaded.dayNameUr)
  if (!png) return false
  await sendReportImage(recipient, png, `Cafe Ali — ${SECTION_CAPTION[section]} (${loaded.report.date})`)
  return true
}

// Sends every non-empty section as its own image. Used for the on-demand
// "5. تمام رپورٹس بھیجیں" option and for the automated daily push (which has
// no menu to choose from, so it always sends the full album).
export async function sendAllSections(recipient: string, loaded: LoadedClosing): Promise<number> {
  let sent = 0
  for (const section of Object.keys(SECTION_RENDERERS) as Exclude<ReportSection, 'all'>[]) {
    if (await sendSection(recipient, loaded, section)) sent += 1
  }
  return sent
}

export async function sendClosingSection(recipient: string, loaded: LoadedClosing, section: ReportSection): Promise<number> {
  if (section === 'all') return sendAllSections(recipient, loaded)
  return (await sendSection(recipient, loaded, section)) ? 1 : 0
}

export async function sendLatestClosingReport(recipient: string): Promise<{ sent: boolean; closingId?: string }> {
  const latest = await loadLatestClosing()
  if (!latest) return { sent: false }
  await sendAllSections(recipient, latest)
  return { sent: true, closingId: latest.id }
}
