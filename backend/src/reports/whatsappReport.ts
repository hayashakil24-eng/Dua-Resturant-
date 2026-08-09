// Renders a ClosingReport (core/closing.ts — the same authoritative figures
// the Closing page saves) as a branded PNG image, fully in Urdu per direct
// client feedback (client-reply-on-whatsapp-report.ogg, voice note): the
// earlier bilingual English/Urdu version was well received on layout/detail,
// but the client asked for the whole thing in Urdu, and for a per-order
// Discount breakdown (which table, how much, why, who authorized it) — the
// same treatment Accounts and Expenses already got. Numbers stay Latin
// digits throughout, matching the client's own real reports (see
// ../../../reports/ in the repo root — every one of their own sample
// screenshots uses Latin numerals even in fully-Urdu-labeled sheets).
//
// Rendered via a headless Chromium (Puppeteer) rather than a pure-JS
// image/PDF library specifically for correct Urdu (Nastaliq) text shaping —
// contextual Arabic-script letter joining is exactly what a real browser
// engine already gets right, which a canvas/PDF library generally doesn't
// without the same underlying text-shaping engine. The font itself
// (@fontsource/noto-nastaliq-urdu) is bundled and inlined as a data: URI —
// this has to work with no internet access (report generation can happen
// fully offline, same as the rest of this app), so it can't reference a
// Google Fonts CDN link.

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import puppeteer from 'puppeteer'
import { karachiDateParts } from '../whatsapp/karachiTime.js'
import type { ClosingReport } from '../core/closing.js'

const require = createRequire(import.meta.url)

let cachedFontBase64: string | null = null
function nastaliqFontBase64(): string {
  if (cachedFontBase64) return cachedFontBase64
  const path = require.resolve('@fontsource/noto-nastaliq-urdu/files/noto-nastaliq-urdu-arabic-400-normal.woff2')
  cachedFontBase64 = readFileSync(path).toString('base64')
  return cachedFontBase64
}

function money(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Translated where it's actually reliable to do so: EXPENSE_CATEGORIES /
// INCOME_CATEGORIES (frontend/src/data/mockData.js) are a closed dropdown,
// not free text, so every value that will ever appear here is known in
// advance. Same for the seeded InventoryItem catalog (prisma/seed.ts) —
// real ingredient names for this specific restaurant, not arbitrary text.
// Deliberately NOT attempted for account names, staff names, or discount/
// expense descriptions — those are genuinely free text typed by whoever
// entered them, and a wrong guessed translation of someone's name or a
// vendor would be worse than leaving it as entered. (Account names get a
// separate, opt-in fix — OnlineAccount.nameUrdu, applied upstream in
// whatsapp/report.ts before this module ever sees the report.)
//
// 'Card Account' / 'Udhaar / Credit' are the two exceptions among
// report.accounts entries that AREN'T user data — they're fixed labels
// core/closing.ts itself generates, so translating them here is exactly as
// safe as the category dictionary below.
const ACCOUNT_LABEL_UR: Record<string, string> = {
  'Card Account': 'کارڈ اکاؤنٹ',
  'Udhaar / Credit': 'ادھار / کریڈٹ',
}

const CATEGORY_UR: Record<string, string> = {
  Rent: 'کرایہ',
  Utilities: 'یوٹیلیٹیز',
  Supplies: 'سامان',
  Gas: 'گیس',
  Maintenance: 'مینٹیننس',
  Marketing: 'مارکیٹنگ',
  Other: 'دیگر',
  Sales: 'سیل',
  Catering: 'کیٹرنگ',
}

const INVENTORY_NAME_UR: Record<string, string> = {
  'Flour (Atta)': 'آٹا',
  'Cooking Oil': 'کوکنگ آئل',
  Chicken: 'چکن',
  Mutton: 'مٹن',
  Beef: 'بیف',
  'Basmati Rice': 'باسمتی چاول',
  Tomatoes: 'ٹماٹر',
  Onions: 'پیاز',
  Yogurt: 'دہی',
  Milk: 'دودھ',
  'Tea Leaves': 'چائے کی پتی',
  Sugar: 'چینی',
  'Spice Mix': 'مصالحہ',
  'Soft Drinks': 'سافٹ ڈرنکس',
  'Mineral Water': 'منرل واٹر',
}

function tr(dict: Record<string, string>, key: string): string {
  return dict[key] ?? key
}

function summaryRow(label: string, amount: number, opts: { strong?: boolean } = {}): string {
  return `
    <tr class="${opts.strong ? 'strong' : ''}">
      <td class="label">${escapeHtml(label)}</td>
      <td class="amount">${money(amount)}</td>
    </tr>`
}

function breakdownTable(title: string, rows: { name: string; amount: number }[]): string {
  if (rows.length === 0) return ''
  const total = rows.reduce((s, r) => s + r.amount, 0)
  return `
    <table class="breakdown">
      <thead><tr><th colspan="2">${escapeHtml(title)}</th></tr></thead>
      <tbody>
        ${rows.map((r) => `<tr><td>${escapeHtml(r.name)}</td><td class="amount">${money(r.amount)}</td></tr>`).join('')}
        <tr class="total"><td>ٹوٹل</td><td class="amount">${money(total)}</td></tr>
      </tbody>
    </table>`
}

// Account ledgers (reports/3.png, reports/5.png): a numbered "S/N, ON A/C,
// AMOUNT" list per named credit account, ending in TOTAL / PAID BILL /
// BALANCE rows — same shape as the client's own "Ali Kakar Sahab Account" /
// "Hotel Mobile Account" sheets, one table per account.
function accountLedgerTable(ledger: { name: string; lines: { table: number | null; amount: number }[]; total: number; paidBill: number; balance: number }): string {
  const label = tr(ACCOUNT_LABEL_UR, ledger.name)
  return `
    <table class="breakdown">
      <thead><tr><th>#</th><th colspan="2">${escapeHtml(label)}</th></tr></thead>
      <tbody>
        ${ledger.lines
          .map(
            (l, i) => `<tr>
              <td>${i + 1}</td>
              <td>${l.table != null ? 'میز ' + l.table : '—'}</td>
              <td class="amount">${money(l.amount)}</td>
            </tr>`,
          )
          .join('')}
        <tr class="total"><td colspan="2">ٹوٹل</td><td class="amount">${money(ledger.total)}</td></tr>
        <tr><td colspan="2">وصول شدہ بل</td><td class="amount">${money(ledger.paidBill)}</td></tr>
        <tr class="total"><td colspan="2">باقی رقم</td><td class="amount">${money(ledger.balance)}</td></tr>
      </tbody>
    </table>`
}

// "Kainsal Bill" — the day's cancelled orders, itemized (reports/4.png), not
// just the count/materialLoss totals the summary table already shows.
function cancelledItemsTable(rows: { table: number | null; description: string; amount: number }[], total: number): string {
  if (rows.length === 0) return ''
  return `
    <table class="breakdown">
      <thead><tr><th>رقم</th><th>تفصیلات</th><th># ٹیبل</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
              <td class="amount">${money(r.amount)}</td>
              <td>${escapeHtml(r.description)}</td>
              <td>${r.table != null ? r.table : '—'}</td>
            </tr>`,
          )
          .join('')}
        <tr class="total"><td class="amount">${money(total)}</td><td colspan="2">ٹوٹل — کینسل بل</td></tr>
      </tbody>
    </table>`
}

// "آفشل بل" (Aafshal / staff-comp bill) — the day's Complimentary orders,
// itemized by recipient (reports/7.png).
function complimentaryItemsTable(rows: { name: string; description: string; amount: number }[], total: number): string {
  if (rows.length === 0) return ''
  return `
    <table class="breakdown">
      <thead><tr><th>رقم</th><th>تفصیلات</th><th>نام</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
              <td class="amount">${money(r.amount)}</td>
              <td>${escapeHtml(r.description)}</td>
              <td>${escapeHtml(r.name)}</td>
            </tr>`,
          )
          .join('')}
        <tr class="total"><td class="amount">${money(total)}</td><td colspan="2">ٹوٹل — آفشل بل</td></tr>
      </tbody>
    </table>`
}

// Item-wise sales — a dashboard-only gap until now (frontend Reports.jsx's
// Item-Wise tab and Top Selling list had no bot-image equivalent). Item
// names stay untranslated, unlike the seeded InventoryItem catalog
// (INVENTORY_NAME_UR above) — the menu is user-editable via the Menu admin
// page, not a fixed set known in advance, so the same "don't guess a
// translation of data we don't control" rule applies here too.
function topSellingTable(items: { name: string; qty: number }[]): string {
  const top = [...items].sort((a, b) => b.qty - a.qty).slice(0, 5)
  if (top.length === 0) return ''
  return `
    <table class="breakdown">
      <thead><tr><th colspan="2">سب سے زیادہ بکنے والی چیزیں</th></tr></thead>
      <tbody>
        ${top.map((it, i) => `<tr><td>${i + 1}. ${escapeHtml(it.name)}</td><td class="amount">${it.qty} فروخت</td></tr>`).join('')}
      </tbody>
    </table>`
}

function itemsSoldTable(items: { name: string; qty: number; total: number }[]): string {
  if (items.length === 0) return ''
  const totalQty = items.reduce((s, i) => s + i.qty, 0)
  const totalRevenue = items.reduce((s, i) => s + i.total, 0)
  return `
    <table class="breakdown">
      <thead><tr><th>چیز</th><th>مقدار</th><th>آمدنی</th></tr></thead>
      <tbody>
        ${items
          .map((it) => `<tr><td>${escapeHtml(it.name)}</td><td class="amount">${it.qty}</td><td class="amount">${money(it.total)}</td></tr>`)
          .join('')}
        <tr class="total"><td>ٹوٹل</td><td class="amount">${totalQty}</td><td class="amount">${money(totalRevenue)}</td></tr>
      </tbody>
    </table>`
}

function inventoryTable(rows: { name: string; qty: number; unit: string }[]): string {
  if (rows.length === 0) return ''
  return `
    <table class="breakdown">
      <thead><tr><th colspan="2">آج استعمال ہونے والا اسٹاک</th></tr></thead>
      <tbody>
        ${rows.map((r) => `<tr><td>${escapeHtml(r.name)}</td><td class="amount">${r.qty} ${escapeHtml(r.unit)}</td></tr>`).join('')}
      </tbody>
    </table>`
}

// Stock bought today (cash vs credit/udhar), plus any cash paid today against
// an OLD supplier credit — kept as its own line so it never reads as a new
// purchase (core/closing.ts's ClosingReport doc comment on these 4 fields).
// Both purchase figures are already inside "کم: اخراجات" above when cash was
// involved (cashPurchases + supplierPayments) — this is a breakdown of that
// same money, not additional spend.
function purchasesBreakdownTable(report: ClosingReport): string {
  if (report.totalPurchases === 0 && report.supplierPayments === 0) return ''
  // Two separate tables, not one — breakdownTable auto-sums a "ٹوٹل" row, and
  // supplierPayments is a different kind of money (an old bill, not today's
  // purchase); folding it into the same total would misstate totalPurchases.
  const purchases = report.totalPurchases > 0
    ? breakdownTable('آج کی خریداری', [
        { name: 'نقد خریداری', amount: report.cashPurchases },
        { name: 'ادھار خریداری', amount: report.creditPurchases },
      ])
    : ''
  const payment = report.supplierPayments > 0
    ? breakdownTable('سپلائر کو ادائیگی (پرانا ادھار)', [{ name: 'رقم', amount: report.supplierPayments }])
    : ''
  return `<div class="breakdowns"><div>${purchases}</div><div>${payment}</div></div>`
}

// Client-requested addition: which orders the day's discount total was made
// up of — table, amount, reason, and who authorized it (matches
// core/closing.ts's DiscountBreakdownLine — table/reason/by can each be
// blank if the order predates those fields being captured, or a legacy
// discount had no reason recorded; render an em-dash rather than nothing).
function discountBreakdownTable(rows: { table: number | null; amount: number; reason: string; by: string }[]): string {
  if (rows.length === 0) return ''
  const total = rows.reduce((s, r) => s + r.amount, 0)
  return `
    <table class="breakdown">
      <thead><tr><th>میز</th><th>رقم</th><th>وجہ</th><th>منظوری</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
              <td>${r.table != null ? r.table : '—'}</td>
              <td class="amount">${money(r.amount)}</td>
              <td>${escapeHtml(r.reason || '—')}</td>
              <td>${escapeHtml(r.by || '—')}</td>
            </tr>`,
          )
          .join('')}
        <tr class="total"><td colspan="3">ٹوٹل ڈسکاؤنٹ</td><td class="amount">${money(total)}</td></tr>
      </tbody>
    </table>`
}

// One page per section (client feedback: wants the client's own habit of
// sending several separate photos for one closing — a summary photo, a
// ledger photo, a cancelled-bill photo — reproduced as separate WhatsApp
// images picked from a menu, instead of one long scrolled image). Shared
// head/branding, different body per section.
// "25 Jul 2026, 02:00 PM → 26 Jul 2026, 03:00 PM" — the window the report
// actually covers. A session routinely spans two calendar days, so the bare
// `report.date` subtitle under-states the period; this line sits beneath it.
// Null for reports saved before periodStart existed (nothing to add).
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Pakistan time explicitly (karachiTime.ts) — the VPS process itself is not
// necessarily hosted there, so Date's own getHours()/getDate() etc. (host
// process local time) would silently drift this stamp by the VPS's UTC
// offset, same bug fixed in whatsapp/report.ts's timeLabelUr.
function stampEn(iso: string): string {
  const { year, month, date, hour, minute } = karachiDateParts(new Date(iso))
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${date} ${MONTHS_EN[month - 1]} ${year}, ${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`
}
function periodLabel(report: ClosingReport): string | null {
  if (!report.periodStart) return null
  return `${stampEn(report.periodStart)} → ${report.periodEnd ? stampEn(report.periodEnd) : 'now'}`
}

function pageShell(dayNameUr: string, date: string, title: string, bodyHtml: string, period?: string | null): string {
  const fontB64 = nastaliqFontBase64()
  return `<!doctype html>
<html dir="rtl" lang="ur"><head><meta charset="utf-8" /><style>
  @font-face {
    font-family: 'Nastaliq';
    src: url(data:font/woff2;base64,${fontB64}) format('woff2');
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 28px; width: 720px;
    font-family: 'Nastaliq', sans-serif;
    direction: rtl;
    color: #1c1c1c; background: #fff;
  }
  .brand { text-align: center; border-bottom: 3px solid #b8860b; padding-bottom: 14px; margin-bottom: 18px; }
  .brand h1 { font-size: 30px; margin: 0; font-family: -apple-system, Segoe UI, Arial, sans-serif; letter-spacing: 1px; color: #1c1c1c; }
  .brand .title { font-size: 18px; font-weight: 700; color: #b8860b; margin-top: 6px; }
  .brand .subtitle { font-size: 15px; color: #666; margin-top: 4px; font-family: -apple-system, Segoe UI, Arial, sans-serif; }
  .brand .period { font-size: 13px; color: #888; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; border-radius: 6px; overflow: hidden; }
  table.summary td { border: 1px solid #ddd; padding: 10px 14px; font-size: 17px; }
  table.summary td.label { text-align: right; }
  table.summary td.amount { text-align: left; direction: ltr; font-variant-numeric: tabular-nums; width: 140px; font-family: -apple-system, Segoe UI, Arial, sans-serif; }
  table.summary tr.strong td { font-weight: 700; background: #faf6ec; }
  table.breakdown { font-size: 15px; }
  table.breakdown th { border: 1px solid #ccc; background: #f3f3f3; padding: 8px 10px; text-align: right; font-weight: 700; }
  table.breakdown td { border: 1px solid #e2e2e2; padding: 7px 10px; text-align: right; }
  table.breakdown td.amount, table.breakdown th:nth-child(2) { text-align: left; direction: ltr; font-variant-numeric: tabular-nums; width: 110px; font-family: -apple-system, Segoe UI, Arial, sans-serif; }
  table.breakdown tr.total td { font-weight: 700; background: #faf6ec; }
  .breakdowns { display: flex; gap: 16px; }
  .breakdowns > div { flex: 1; }
  .footer { font-size: 13px; color: #999; text-align: center; margin-top: 4px; font-family: -apple-system, Segoe UI, Arial, sans-serif; }
</style></head>
<body>
  <div class="brand">
    <h1>CAFÉ ALI</h1>
    <div class="title">${escapeHtml(title)}</div>
    <div class="subtitle">${escapeHtml(dayNameUr)} — ${escapeHtml(date)}</div>
    ${period ? `<div class="subtitle period" dir="ltr">${escapeHtml(period)}</div>` : ''}
  </div>
  ${bodyHtml}
  <div class="footer">کیفے علی مینجمنٹ سسٹم کی جانب سے تیار کردہ</div>
</body></html>`
}

async function renderHtmlToPng(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 760, height: 200, deviceScaleFactor: 2 })
    // 'domcontentloaded', not 'networkidle0' — the latter isn't a valid
    // setContent waitUntil option (only page.goto's), and isn't needed
    // anyway: the font is inlined as a data: URI, so there's no external
    // request to wait on.
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    const png = await page.screenshot({ type: 'png', fullPage: true })
    return Buffer.from(png)
  } finally {
    await browser.close()
  }
}

// The headline sheet — gross/discount/net/accounts/net-cash/expenses/handover,
// plus the accounts and expense-category breakdowns, the discount breakdown,
// inventory used, and the day's order/GST footer stats. Always renders
// (never null) — this is the one section every closing has.
export async function renderSummarySection(report: ClosingReport, dayNameUr: string): Promise<Buffer> {
  const body = `
    <table class="summary">
      ${summaryRow('ٹوٹل سیل', report.grossSale)}
      ${summaryRow('کم: ڈسکاؤنٹ', report.discount)}
      ${summaryRow('نیٹ سیل', report.netSale, { strong: true })}
      ${report.accounts.map((a) => summaryRow(tr(ACCOUNT_LABEL_UR, a.name), a.amount)).join('')}
      ${summaryRow('نیٹ کیش سیل', report.netCashSales, { strong: true })}
      ${summaryRow('کم: اخراجات', report.expenses)}
      ${summaryRow('باقی نقد رقم', report.remainingHandover, { strong: true })}
    </table>

    <div class="breakdowns">
      <div>${breakdownTable('اکاؤنٹس', report.accounts.map((a) => ({ name: tr(ACCOUNT_LABEL_UR, a.name), amount: a.amount })))}</div>
      <div>${breakdownTable('اخراجات کی قسم', report.expensesByCategory.map((e) => ({ name: tr(CATEGORY_UR, e.category), amount: e.amount })))}</div>
    </div>

    ${purchasesBreakdownTable(report)}

    ${discountBreakdownTable(report.discountBreakdown)}

    ${inventoryTable(report.inventoryUsed.map((i) => ({ ...i, name: tr(INVENTORY_NAME_UR, i.name) })))}

    <div class="footer">
      آرڈرز: ${report.totalOrders} (منسوخ شدہ: ${report.cancelledOrders}) &nbsp;•&nbsp;
      جی ایس ٹی وصول شدہ: ${money(report.gstCollected)}
    </div>`
  return renderHtmlToPng(pageShell(dayNameUr, report.date, 'خلاصہ', body, periodLabel(report)))
}

// Ali Kakar / Hotel-style per-account ledgers (reports/3.png, reports/5.png).
// Null when the day had no named-account Udhaar activity — nothing to send.
export async function renderLedgersSection(report: ClosingReport, dayNameUr: string): Promise<Buffer | null> {
  if (report.accountLedgers.length === 0) return null
  const body = `<div class="breakdowns">${report.accountLedgers.map((l) => `<div>${accountLedgerTable(l)}</div>`).join('')}</div>`
  return renderHtmlToPng(pageShell(dayNameUr, report.date, 'اکاؤنٹ لیجرز', body, periodLabel(report)))
}

// "Kainsal Bill" (reports/4.png). Null when nothing was cancelled that day.
export async function renderCancelledSection(report: ClosingReport, dayNameUr: string): Promise<Buffer | null> {
  if (report.cancelledItems.length === 0) return null
  return renderHtmlToPng(pageShell(dayNameUr, report.date, 'کینسل بل', cancelledItemsTable(report.cancelledItems, report.cancelledTotal), periodLabel(report)))
}

// "آفشل بل" (reports/7.png). Null when nothing was comped that day.
export async function renderComplimentarySection(report: ClosingReport, dayNameUr: string): Promise<Buffer | null> {
  if (report.complimentaryItems.length === 0) return null
  return renderHtmlToPng(pageShell(dayNameUr, report.date, 'آفشل بل', complimentaryItemsTable(report.complimentaryItems, report.complimentaryTotal), periodLabel(report)))
}

// Top Selling + full Item-Wise sales, one image (same "bundle related blocks
// into one section" pattern as renderSummarySection). Null when nothing was
// punched that session — same guard shape as every other optional section.
export async function renderItemsSection(report: ClosingReport, dayNameUr: string): Promise<Buffer | null> {
  if (report.itemsSold.length === 0) return null
  const body = `${topSellingTable(report.itemsSold)}${itemsSoldTable(report.itemsSold)}`
  return renderHtmlToPng(pageShell(dayNameUr, report.date, 'چیز کی بنیاد پر فروخت', body, periodLabel(report)))
}
