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

function reportHtml(report: ClosingReport, dayNameUr: string): string {
  const fontB64 = nastaliqFontBase64()
  return `<!doctype html>
<html dir="rtl" lang="ur"><head><meta charset="utf-8" /><style>
  @font-face {
    font-family: 'Nastaliq';
    src: url(data:font/woff2;base64,${fontB64}) format('woff2');
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px; width: 720px;
    font-family: 'Nastaliq', sans-serif;
    direction: rtl;
    color: #111; background: #fff;
  }
  h1 { text-align: center; font-size: 30px; margin: 0 0 6px; font-family: -apple-system, Segoe UI, Arial, sans-serif; letter-spacing: 0.5px; }
  .subtitle { text-align: center; font-size: 17px; color: #444; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  table.summary td { border: 1px solid #999; padding: 9px 14px; font-size: 17px; }
  table.summary td.label { text-align: right; }
  table.summary td.amount { text-align: left; direction: ltr; font-variant-numeric: tabular-nums; width: 140px; font-family: -apple-system, Segoe UI, Arial, sans-serif; }
  table.summary tr.strong td { font-weight: 700; background: #f3f3f3; }
  table.breakdown { font-size: 15px; }
  table.breakdown th { border: 1px solid #999; background: #eee; padding: 7px 10px; text-align: right; }
  table.breakdown td { border: 1px solid #ccc; padding: 6px 10px; text-align: right; }
  table.breakdown td.amount, table.breakdown th:nth-child(2) { text-align: left; direction: ltr; font-variant-numeric: tabular-nums; width: 110px; font-family: -apple-system, Segoe UI, Arial, sans-serif; }
  table.breakdown tr.total td { font-weight: 700; background: #f7f7f7; }
  .breakdowns { display: flex; gap: 16px; }
  .breakdowns > div { flex: 1; }
  .footer { font-size: 13px; color: #777; text-align: center; margin-top: 8px; font-family: -apple-system, Segoe UI, Arial, sans-serif; }
</style></head>
<body>
  <h1>CAFÉ ALI</h1>
  <div class="subtitle">${escapeHtml(dayNameUr)} — ${escapeHtml(report.date)}</div>

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

  ${discountBreakdownTable(report.discountBreakdown)}

  ${inventoryTable(report.inventoryUsed.map((i) => ({ ...i, name: tr(INVENTORY_NAME_UR, i.name) })))}

  <div class="footer">
    آرڈرز: ${report.totalOrders} (منسوخ شدہ: ${report.cancelledOrders}) &nbsp;•&nbsp;
    جی ایس ٹی وصول شدہ: ${money(report.gstCollected)} &nbsp;•&nbsp;
    کیفے علی مینجمنٹ سسٹم کی جانب سے تیار کردہ
  </div>
</body></html>`
}

// `dayNameUr` is the already-Urdu-translated day name (whatsapp/report.ts's
// dayNameUrFor) — this module renders, it doesn't own the translation table.
export async function renderClosingReportImage(report: ClosingReport, dayNameUr: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 760, height: 200, deviceScaleFactor: 2 })
    // 'domcontentloaded', not 'networkidle0' — the latter isn't a valid
    // setContent waitUntil option (only page.goto's), and isn't needed
    // anyway: the font is inlined as a data: URI, so there's no external
    // request to wait on.
    await page.setContent(reportHtml(report, dayNameUr), { waitUntil: 'domcontentloaded' })
    const png = await page.screenshot({ type: 'png', fullPage: true })
    return Buffer.from(png)
  } finally {
    await browser.close()
  }
}
