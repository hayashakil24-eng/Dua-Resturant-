// Shared by both send paths (schedule.ts's automated daily send, and
// vps/app.ts's on-demand webhook reply) — "render a saved closing and send
// it to someone." The only difference between the two paths is what
// triggers the call and which database it runs against (the local server's
// own DB for the schedule; the VPS's synced copy for the webhook) — the
// prisma import is the shared singleton either way, pointed wherever this
// process's DATABASE_URL says.

import { prisma } from '../db/client.js'
import { getLatestClosing } from '../services/closing.service.js'
import { renderClosingReportImage } from '../reports/whatsappReport.js'
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

export interface LoadedClosing {
  id: string
  report: ClosingReport
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

function parseClosing(row: { id: string; reportJson: string }): ClosingReport | null {
  try {
    return JSON.parse(row.reportJson) as ClosingReport
  } catch {
    return null
  }
}

// Null if nothing has ever been closed, or the saved record is corrupt.
export async function loadLatestClosing(): Promise<LoadedClosing | null> {
  const latest = await getLatestClosing()
  if (!latest) return null
  const report = parseClosing(latest)
  if (!report) return null
  return { id: latest.id, report: await withAccountUrduNames(report) }
}

export async function loadClosingById(id: string): Promise<LoadedClosing | null> {
  const row = await prisma.dailyClosing.findUnique({ where: { id } })
  if (!row) return null
  const report = parseClosing(row)
  if (!report) return null
  return { id: row.id, report: await withAccountUrduNames(report) }
}

export interface ClosingSummary {
  id: string
  date: string
  dayNameUr: string
}

// Client feedback (requirements.md §7's "admin can request a report by
// messaging the system directly"): the webhook should offer a numbered
// Urdu menu of recent closings rather than always just the latest one.
// Capped at 7 (about a week) — a "send all" option pointed at an unbounded
// history would be an unbounded number of WhatsApp API calls per tap.
const RECENT_CLOSINGS_LIMIT = 7

export async function listRecentClosings(): Promise<ClosingSummary[]> {
  const rows = await prisma.dailyClosing.findMany({
    orderBy: { closingTime: 'desc' },
    take: RECENT_CLOSINGS_LIMIT,
    select: { id: true, date: true },
  })
  return rows.map((r) => ({ id: r.id, date: r.date, dayNameUr: dayNameUrFor(r.date) }))
}

async function sendOne(recipient: string, loaded: LoadedClosing): Promise<void> {
  const png = await renderClosingReportImage(loaded.report, dayNameUrFor(loaded.report.date))
  await sendReportImage(recipient, png, `Cafe Ali — Daily Closing Report (${loaded.report.date})`)
}

export async function sendLatestClosingReport(recipient: string): Promise<{ sent: boolean; closingId?: string }> {
  const latest = await loadLatestClosing()
  if (!latest) return { sent: false }
  await sendOne(recipient, latest)
  return { sent: true, closingId: latest.id }
}

export async function sendClosingReportById(recipient: string, id: string): Promise<{ sent: boolean }> {
  const loaded = await loadClosingById(id)
  if (!loaded) return { sent: false }
  await sendOne(recipient, loaded)
  return { sent: true }
}
