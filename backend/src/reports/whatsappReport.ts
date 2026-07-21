// Renders a ClosingReport (core/closing.ts — the same authoritative figures
// the Closing page saves) as a branded PNG image, matching the layout the
// client already shares manually over WhatsApp today (see ../../../reports/
// in the repo root for the reference screenshots this was built against):
// a CAFÉ ALI header, day + date, GROSS SALE → DISCOUNT → NET SALE → account
// channels → NET CASH SALES → EXPENSES → REMAINING CASH HANDOVER, plus the
// accounts and expense-category breakdown tables.
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

function summaryRow(labelEn: string, labelUr: string | null, amount: number, opts: { strong?: boolean } = {}): string {
  const urduSuffix = labelUr ? ` <span class="ur">( ${escapeHtml(labelUr)} )</span>` : ''
  return `
    <tr class="${opts.strong ? 'strong' : ''}">
      <td class="label">${escapeHtml(labelEn)}${urduSuffix}</td>
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
        <tr class="total"><td>Total</td><td class="amount">${money(total)}</td></tr>
      </tbody>
    </table>`
}

function reportHtml(report: ClosingReport, dayName: string): string {
  const fontB64 = nastaliqFontBase64()
  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  @font-face {
    font-family: 'Nastaliq';
    src: url(data:font/woff2;base64,${fontB64}) format('woff2');
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px; width: 720px;
    font-family: -apple-system, Segoe UI, Arial, sans-serif;
    color: #111; background: #fff;
  }
  .ur { font-family: 'Nastaliq'; direction: rtl; unicode-bidi: embed; font-size: 1.05em; }
  h1 { text-align: center; font-size: 26px; margin: 0 0 4px; letter-spacing: 0.5px; }
  .subtitle { text-align: center; font-size: 15px; color: #444; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  table.summary td { border: 1px solid #999; padding: 8px 12px; font-size: 15px; }
  table.summary td.label { text-align: left; }
  table.summary td.amount { text-align: right; font-variant-numeric: tabular-nums; width: 140px; }
  table.summary tr.strong td { font-weight: 700; background: #f3f3f3; }
  table.breakdown { font-size: 13px; }
  table.breakdown th { border: 1px solid #999; background: #eee; padding: 6px 10px; text-align: left; }
  table.breakdown td { border: 1px solid #ccc; padding: 5px 10px; }
  table.breakdown td.amount { text-align: right; font-variant-numeric: tabular-nums; width: 110px; }
  table.breakdown tr.total td { font-weight: 700; background: #f7f7f7; }
  .breakdowns { display: flex; gap: 16px; }
  .breakdowns > div { flex: 1; }
  .footer { font-size: 11px; color: #777; text-align: center; margin-top: 8px; }
</style></head>
<body>
  <h1>CAFÉ ALI</h1>
  <div class="subtitle">${escapeHtml(dayName)} — ${escapeHtml(report.date)}</div>

  <table class="summary">
    ${summaryRow('Gross Sale', 'ٹوٹل سیل', report.grossSale)}
    ${summaryRow('Less: Discount', 'ڈسکاؤنٹ', report.discount)}
    ${summaryRow('Net Sale', 'نیٹ سیل', report.netSale, { strong: true })}
    ${report.accounts.map((a) => summaryRow(a.name, null, a.amount)).join('')}
    ${summaryRow('Net Cash Sales', 'نیٹ کیش سیل', report.netCashSales, { strong: true })}
    ${summaryRow('Less: Expenses', 'اخراجات', report.expenses)}
    ${summaryRow('Remaining Cash Handover', 'باقی نقد رقم', report.remainingHandover, { strong: true })}
  </table>

  <div class="breakdowns">
    <div>${breakdownTable('Accounts (اکاؤنٹس)', report.accounts)}</div>
    <div>${breakdownTable('Expenses by Category (اخراجات کی قسم)', report.expensesByCategory.map((e) => ({ name: e.category, amount: e.amount })))}</div>
  </div>

  <div class="footer">
    Orders: ${report.totalOrders} (Cancelled: ${report.cancelledOrders}) &nbsp;•&nbsp;
    GST Collected: ${money(report.gstCollected)} &nbsp;•&nbsp;
    Generated by Cafe Ali Management System
  </div>
</body></html>`
}

export async function renderClosingReportImage(report: ClosingReport, dayName: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 760, height: 200, deviceScaleFactor: 2 })
    // 'domcontentloaded', not 'networkidle0' — the latter isn't a valid
    // setContent waitUntil option (only page.goto's), and isn't needed
    // anyway: the font is inlined as a data: URI, so there's no external
    // request to wait on.
    await page.setContent(reportHtml(report, dayName), { waitUntil: 'domcontentloaded' })
    const png = await page.screenshot({ type: 'png', fullPage: true })
    return Buffer.from(png)
  } finally {
    await browser.close()
  }
}
