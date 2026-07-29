// Builds the Cafe Ali User Guide PDF from the Markdown sources.
//
// Run with Electron (not plain node): its bundled Chromium is the only
// PDF engine available here — no pandoc/wkhtmltopdf/puppeteer on this machine.
//
// Two passes, because a table of contents needs real page numbers and Chromium
// has no target-counter support:
//   1. every "## " section is forced onto a fresh page, so each chunk can be
//      rendered ALONE and its page count read back from the PDF bytes;
//      accumulating those counts gives each section's exact start page.
//   2. the TOC is rebuilt with those numbers and the whole document rendered.

import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mdToHtml, resetHeadingIds } from './md2html.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '..')
const OUT = path.join(SRC, 'Cafe-Ali-User-Guide.pdf')
const TMP = path.join(HERE, '.tmp')

const FILES = [
  '00-front-matter.md',
  '01-access-and-dashboard.md',
  '02-operations.md',
  '03-menu-and-kitchen.md',
  '04-people.md',
  '05-finance-and-reports.md',
  '06-workflows-faq-glossary.md',
]

const CSS = `
:root { --ink:#1a1613; --dim:#5d5347; --gold:#8a6e32; --line:#d9d0bf; --soft:#faf7f1; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Segoe UI", "Noto Sans", Arial, sans-serif;
  font-size: 10.2pt; line-height: 1.55; color: var(--ink);
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
h1, h2, h3, h4 { font-family: Georgia, "Times New Roman", serif; color: var(--gold); line-height: 1.25; }
h1 { font-size: 20pt; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 2px solid var(--gold); }
h2 { font-size: 15pt; margin: 22px 0 10px; padding-bottom: 5px; border-bottom: 1px solid var(--line); }
h3 { font-size: 12pt; margin: 18px 0 7px; color: #6f5827; }
h4 { font-size: 10.6pt; margin: 14px 0 6px; color: var(--dim); }
h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
p { margin: 7px 0; }
strong { color: #241d16; }
code {
  font-family: Consolas, "Courier New", monospace; font-size: 9pt;
  background: #f1ece1; border: 1px solid var(--line); border-radius: 3px; padding: 0 3px;
}
hr { border: 0; border-top: 1px solid var(--line); margin: 16px 0; }

.tablewrap { break-inside: auto; }
table { width: 100%; border-collapse: collapse; margin: 9px 0 13px; font-size: 8.9pt; }
th, td { border: 1px solid var(--line); padding: 5px 7px; text-align: left; vertical-align: top; }
th { background: #ece4d5; color: #4a3c22; font-weight: 700; font-size: 8.4pt;
     text-transform: uppercase; letter-spacing: .3px; }
tbody tr:nth-child(even) td { background: #fbf9f5; }
tr { break-inside: avoid; page-break-inside: avoid; }
thead { display: table-header-group; }

ul, ol { margin: 7px 0 10px; padding-left: 22px; }
li { margin: 3px 0; }

blockquote {
  margin: 11px 0; padding: 9px 13px;
  background: var(--soft); border-left: 3px solid var(--gold); border-radius: 0 4px 4px 0;
  break-inside: avoid; page-break-inside: avoid;
}
blockquote p { margin: 4px 0; }
blockquote h3 { margin: 2px 0 6px; font-size: 11pt; }

pre.diagram {
  font-family: Consolas, "Courier New", monospace; font-size: 8.2pt; line-height: 1.35;
  background: var(--soft); border: 1px solid var(--line); border-radius: 4px;
  padding: 10px 12px; overflow: hidden; white-space: pre;
  break-inside: avoid; page-break-inside: avoid;
}

.pagebreak { break-before: page; page-break-before: always; height: 0; }
/* Every top-level section starts its own page — this is what makes the
   per-chunk page counting in pass 1 exact. */
h1 { break-before: page; page-break-before: always; }
h1.nobreak, body > h1:first-of-type { break-before: auto; page-break-before: auto; }

/* Cover */
.cover { text-align: center; padding-top: 120px; break-after: page; page-break-after: always; }
.cover .logo { font-size: 60pt; }
.cover h1 { border: 0; font-size: 34pt; margin: 18px 0 4px; break-before: auto; }
.cover .sub { font-size: 13pt; color: var(--dim); margin-bottom: 40px; }
.cover .meta { display: inline-block; text-align: left; font-size: 10pt; }
.cover .meta table { width: auto; }
.cover .rule { width: 120px; border-top: 3px solid var(--gold); margin: 24px auto; }

/* Table of contents */
.toc h1 { break-before: auto; }
.toc table { font-size: 9.4pt; }
.toc td { border: 0; border-bottom: 1px dotted var(--line); padding: 3px 6px; }
.toc td.num { width: 52px; color: var(--gold); font-weight: 700; }
.toc td.pg { width: 46px; text-align: right; color: var(--dim); }
.toc tr.lvl1 td { font-weight: 700; padding-top: 9px; }
.toc tr.lvl2 td.title { padding-left: 16px; }
`

const HEADER = `
<div style="font-family:Georgia,serif;font-size:7.5pt;color:#8a6e32;width:100%;
            padding:0 14mm;display:flex;justify-content:space-between;border-bottom:.5pt solid #d9d0bf;">
  <span>Cafe Ali — Restaurant Management System</span><span>User Guide v1.0</span>
</div>`

const FOOTER = `
<div style="font-family:Georgia,serif;font-size:7.5pt;color:#5d5347;width:100%;
            padding:0 14mm;display:flex;justify-content:space-between;border-top:.5pt solid #d9d0bf;">
  <span>Software by SoftDap · Support +92 334 3207049</span>
  <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>`

const PDF_OPTS = {
  pageSize: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: HEADER,
  footerTemplate: FOOTER,
  margins: { top: 0.7, bottom: 0.7, left: 0.6, right: 0.6 },
}

const page = (body) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Cafe Ali User Guide</title>
   <style>${CSS}</style></head><body>${body}</body></html>`

// Chromium writes one "/Type /Page" object per page (and "/Type /Pages" for the
// tree node) — counting the former is the cheapest reliable page count without
// pulling in a PDF parser.
function countPages(buf) {
  const s = buf.toString('latin1')
  const m = s.match(/\/Type\s*\/Page[^s]/g)
  return m ? m.length : 0
}

// One window reused for every render. Creating and destroying a BrowserWindow
// per chunk made the second load fail with ERR_FAILED — 68 renders is exactly
// the case a single long-lived window is for anyway.
let win = null
let renderSeq = 0
async function renderPdf(html) {
  if (!win) {
    win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, javascript: false },
    })
  }
  const file = path.join(TMP, `r${++renderSeq}.html`)
  fs.writeFileSync(file, html, 'utf8')
  try {
    await win.loadFile(file)
    return await win.webContents.printToPDF(PDF_OPTS)
  } finally {
    fs.rmSync(file, { force: true })
  }
}

// ---------------------------------------------------------------------------

function buildCover() {
  return `<section class="cover">
    <div class="logo">☕</div>
    <h1>Cafe Ali</h1>
    <div class="sub">Restaurant Management System<br/>Mukammal User Guide</div>
    <div class="rule"></div>
    <div class="meta"><table>
      <tr><td><strong>Product</strong></td><td>Cafe Ali — Restaurant / Hotel Management System</td></tr>
      <tr><td><strong>Type</strong></td><td>Desktop software (Windows) · Electron · offline-first</td></tr>
      <tr><td><strong>App version</strong></td><td>1.0.0</td></tr>
      <tr><td><strong>Guide version</strong></td><td>1.0</td></tr>
      <tr><td><strong>Tareekh</strong></td><td>28 July 2026</td></tr>
      <tr><td><strong>Zabaan</strong></td><td>Roman Urdu</td></tr>
      <tr><td><strong>Roles</strong></td><td>Admin · Manager · Cashier · Kitchen</td></tr>
    </table></div>
    <div class="rule"></div>
    <p style="font-size:9pt;color:#5d5347;">Software by SoftDap · Support: +92 334 3207049</p>
  </section>`
}

function buildToc(entries, pages) {
  const rows = entries
    .map((e, i) => {
      const num = e.text.match(/^([\d.]+)\s+/)
      const label = num ? e.text.slice(num[0].length) : e.text
      return `<tr class="lvl${e.level}">
        <td class="num">${num ? num[1] : ''}</td>
        <td class="title">${label}</td>
        <td class="pg">${pages ? pages[i] : '—'}</td>
      </tr>`
    })
    .join('')
  return `<section class="toc"><h1 class="nobreak">Table of Contents</h1>
    <table><tbody>${rows}</tbody></table></section>
    <div class="pagebreak"></div>`
}

async function main() {
  fs.rmSync(TMP, { recursive: true, force: true })
  fs.mkdirSync(TMP, { recursive: true })

  // --- Parse every source file into one stream of HTML + headings ----------
  resetHeadingIds()
  let bodyHtml = ''
  const headings = []
  for (const f of FILES) {
    const md = fs.readFileSync(path.join(SRC, f), 'utf8')
    const r = mdToHtml(md)
    bodyHtml += r.html + '\n'
    headings.push(...r.headings)
  }

  // The front matter file carries its own hand-written cover + TOC; drop
  // everything up to the first real content heading ("1. Introduction") so the
  // generated cover/TOC replace them instead of duplicating.
  const startAt = bodyHtml.indexOf('<h1 id="h')
  const introIdx = bodyHtml.search(/<h1 id="h\d+">1\. Introduction<\/h1>/)
  const content = introIdx > -1 ? bodyHtml.slice(introIdx) : bodyHtml.slice(startAt)

  // TOC entries: numbered h1/h2 only (h3 would run to several hundred rows).
  const tocEntries = headings.filter(
    (h) => h.level <= 2 && /^\d+(\.\d+)*\.?\s/.test(h.text),
  )

  // --- Pass 1: exact page number per TOC entry ----------------------------
  // Render the document truncated immediately AFTER each heading. The page
  // count of that prefix IS the page the heading sits on — no assumption about
  // where Chromium chooses to break, and no forced one-section-per-page layout
  // just to make the arithmetic work.
  const front = buildCover() + buildToc(tocEntries, null)
  console.log(`Pass 1 — measuring ${tocEntries.length} headings…`)

  const tocPages = []
  for (const e of tocEntries) {
    const marker = `<h${e.level} id="${e.id}">`
    const at = content.indexOf(marker)
    const end = at === -1 ? 0 : content.indexOf(`</h${e.level}>`, at) + 5
    const buf = await renderPdf(page(front + content.slice(0, end)))
    tocPages.push(Math.max(1, countPages(buf)))
    process.stdout.write('.')
  }
  console.log('')

  // --- Pass 2: final document ---------------------------------------------
  console.log('Pass 2 — rendering final PDF…')
  const finalHtml = page(buildCover() + buildToc(tocEntries, tocPages) + content)
  const finalBuf = await renderPdf(finalHtml)
  fs.writeFileSync(OUT, finalBuf)
  fs.writeFileSync(path.join(SRC, 'Cafe-Ali-User-Guide.html'), finalHtml, 'utf8')

  console.log(`\n✓ ${OUT}`)
  console.log(`  ${countPages(finalBuf)} pages · ${(finalBuf.length / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  ${tocEntries.length} TOC entries · ${headings.length} headings total`)

  fs.rmSync(TMP, { recursive: true, force: true })
}

app.whenReady().then(async () => {
  try {
    await main()
    app.exit(0)
  } catch (err) {
    console.error(err)
    app.exit(1)
  }
})
