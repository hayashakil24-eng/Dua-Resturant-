// Plain-ASCII ESC/POS bill builder for the receipt print surface — see
// print.js's printReceiptRaw() and electron/rawPrint.js for why this exists
// alongside the HTML/CSS receipt (#printable-receipt in Billing.jsx):
// Chromium's silent print pipeline (print-silent) fails outright against
// real thermal-printer drivers on this Electron version, so the receipt is
// built here as raw printer command bytes instead and sent straight to the
// Windows spooler, never through webContents.print().
//
import { SPECIAL_TABLE_IDS } from '../data/mockData.js'

// COLS is the number of monospace Font-A characters per line the target
// printer fits on an 80mm roll — 42 is a commonly-safe default across cheap
// 80mm ESC/POS clones (Black Copper/Xprinter/Gainscha-style firmware), but
// this has NOT been verified against the actual client BC-98AC yet; if the
// printed bill's columns run off the edge or leave a big blank margin,
// adjust this first before touching anything else below.
const COLS = 42

const ESC = 0x1b
const GS = 0x1d

// Renderer runs under contextIsolation with no Node Buffer — plain-ASCII
// text only (this receipt's content is all ASCII, see money() below), so a
// simple char-code map is enough; anything outside 0x00-0xff (shouldn't
// occur here) is replaced with '?' rather than silently corrupting the byte
// stream the printer will interpret as commands.
function textBytes(str) {
  const out = []
  for (const ch of String(str)) {
    const code = ch.codePointAt(0)
    out.push(code <= 0xff ? code : 0x3f)
  }
  return out
}

class ReceiptBuilder {
  constructor() {
    this.bytes = [ESC, 0x40] // ESC @ — initialize printer
  }
  raw(...codes) {
    this.bytes.push(...codes)
    return this
  }
  text(str) {
    this.bytes.push(...textBytes(str))
    return this
  }
  line(str = '') {
    return this.text(str).raw(0x0a)
  }
  feed(n = 1) {
    return this.raw(0x1b, 0x64, n) // ESC d n — feed n lines
  }
  align(mode) {
    // 0 left, 1 center, 2 right
    return this.raw(ESC, 0x61, mode)
  }
  bold(on) {
    return this.raw(ESC, 0x45, on ? 1 : 0)
  }
  doubleSize(on) {
    return this.raw(GS, 0x21, on ? 0x11 : 0x00) // double height + width
  }
  rule(ch = '-') {
    return this.line(ch.repeat(COLS))
  }
  // GS v 0 — raster bit image. widthPx must be a multiple of 8 (packed
  // 8 pixels/byte, MSB first, bit=1 -> print/black — see receiptLogo.js's
  // generation comment for how base64 was produced). Standard on genuine
  // ESC/POS thermal printers, including cheap clones — but NOT currently
  // called anywhere (see buildReceiptEscPos's comment above the logo line):
  // sending this to a non-ESC/POS printer (confirmed on an office EPSON
  // L3150) caused runaway/non-stop feeding, since that printer's own
  // firmware misinterpreted the raw image bytes as its own control
  // sequences. Only re-enable once verified against a real ESC/POS printer
  // (the actual client BC-98AC).
  image(widthPx, heightPx, base64) {
    const widthBytes = widthPx / 8
    const binary = atob(base64)
    const data = new Array(binary.length)
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i)
    this.raw(GS, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, heightPx & 0xff, (heightPx >> 8) & 0xff)
    this.bytes.push(...data)
    return this
  }
  // Plain ASCII box (+/-/|) around one or more centered lines — deliberately
  // not box-drawing/extended-ASCII glyphs, which depend on the printer's
  // active code page and could render as garbage on an untested printer;
  // +/-/| sit in base 0x00-0x7F ASCII, so they print identically everywhere.
  box(lines) {
    const inner = COLS - 2
    this.line(`+${'-'.repeat(inner)}+`)
    for (const l of lines) {
      const s = String(l).slice(0, inner)
      const padTotal = inner - s.length
      const left = Math.floor(padTotal / 2)
      const right = padTotal - left
      this.line(`|${' '.repeat(left)}${s}${' '.repeat(right)}|`)
    }
    this.line(`+${'-'.repeat(inner)}+`)
    return this
  }
  cut() {
    // GS V 66 0 — partial cut, no extra feed param needed on most clones;
    // a few extra blank lines first so the cut doesn't land mid-text on
    // printers with a fixed cutter offset below the print head.
    return this.feed(3).raw(GS, 0x56, 0x42, 0x00)
  }
  toBytes() {
    return new Uint8Array(this.bytes)
  }
}

function padRight(s, n) {
  s = String(s)
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length)
}
function padLeft(s, n) {
  s = String(s)
  return s.length >= n ? s.slice(-n) : ' '.repeat(n - s.length) + s
}
// Wraps a string into <=width chunks, breaking on spaces where possible.
function wrap(str, width) {
  const words = String(str).split(' ')
  const lines = []
  let cur = ''
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w
    if (candidate.length > width) {
      if (cur) lines.push(cur)
      cur = w.length > width ? w.slice(0, width) : w
    } else {
      cur = candidate
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

// Deliberately plain ASCII regardless of the app's active language (Urdu
// mode's Eastern-Arabic digits, from format.js's money(), aren't
// representable on a standard ESC/POS code page) — same numeric value,
// always Latin digits, so the raw bill stays legible on any thermal printer.
const fmtMoney = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-PK')}`

function twoCol(label, value, width = COLS) {
  const gap = Math.max(1, width - label.length - value.length)
  return `${label}${' '.repeat(gap)}${value}`
}

// Mirrors Billing.jsx's <Receipt> JSX field-for-field so the raw bill and
// the on-screen/HTML slip never drift apart — see that component for the
// source of truth on which fields apply to a delivery vs. dine-in order.
export function buildReceiptEscPos({
  order,
  rate,
  subtotal,
  tax,
  discount,
  total,
  unitOf,
  tableLabelText,
  isDelivery,
  udhaarPaid,
  udhaarRemaining,
  dateLabel,
  timeLabel,
}) {
  const b = new ReceiptBuilder()

  b.align(1) // center
  // Logo image printing (b.image(LOGO_WIDTH, LOGO_HEIGHT, LOGO_ESCPOS_BASE64))
  // is DISABLED here on purpose — tried once, and on the office EPSON L3150
  // (not an ESC/POS printer; RAW bytes go straight to its own firmware,
  // which speaks a different command language) the raw GS v 0 image bytes
  // got misinterpreted as printer commands and caused runaway, non-stop
  // feeding until the printer was power-cycled. This command is very likely
  // fine on a real ESC/POS printer (the actual BC-98AC) since GS v 0 is
  // standard there — but do NOT re-enable/test this against any printer
  // that isn't confirmed genuinely ESC/POS-compatible; verify on the BC-98AC
  // first.
  b.bold(true).doubleSize(true).line('CAFE ALI').doubleSize(false).bold(false)
  b.line('Main Hawksbay Beach, Zulfiqar Chowrangi,')
  b.line('Maripur Road, Karachi')
  b.line('0313-2870111')
  b.rule('=')
  b.bold(true).line('SALE RECEIPT').bold(false)
  b.rule('=')

  const orderNo = (order.id.match(/\d+/) || [order.id])[0]
  b.bold(true)
  b.box([`Order # ${orderNo}`])
  b.bold(false)

  b.align(0) // left
  b.line(twoCol('Date :', dateLabel))
  b.line(twoCol('Time :', timeLabel))
  if (isDelivery) {
    b.line(twoCol('Rider :', order.deliveryRiderName || '-'))
    b.line(twoCol('Customer :', order.deliveryCustomerName || '-'))
    b.line(twoCol('Phone :', order.deliveryPhone || '-'))
    for (const l of wrap(`Address : ${order.deliveryAddress || '-'}`, COLS)) b.line(l)
    b.line(twoCol('Delivery Charges :', fmtMoney(order.deliveryCharge)))
  } else {
    b.line(twoCol('Server :', order.waiter || '-'))
    b.line(twoCol('Table :', tableLabelText))
  }
  b.rule('-')

  // Qty(5) Rate(9) Amount(10) — remainder goes to the item name column.
  const QTY_W = 5
  const RATE_W = 9
  const AMT_W = 10
  const NAME_W = COLS - QTY_W - RATE_W - AMT_W
  b.bold(true)
  b.line(`${padRight('Qty', QTY_W)}${padRight('Item', NAME_W)}${padLeft('Rate', RATE_W)}${padLeft('Amount', AMT_W)}`)
  b.bold(false)
  b.rule('-')
  for (const it of order.items) {
    const qtyLabel = unitOf(it.menuItemId) === 'kg' ? `${(Math.round((Number(it.qty) || 0) * 100) / 100).toFixed(2)}kg` : String(it.qty)
    const nameLines = wrap(it.name, NAME_W)
    b.line(`${padRight(qtyLabel, QTY_W)}${padRight(nameLines[0], NAME_W)}${padLeft(fmtMoney(Math.round(it.price)), RATE_W)}${padLeft(fmtMoney(Math.round(it.price * it.qty)), AMT_W)}`)
    for (const extra of nameLines.slice(1)) {
      b.line(`${' '.repeat(QTY_W)}${padRight(extra, NAME_W)}${' '.repeat(RATE_W)}${' '.repeat(AMT_W)}`)
    }
    if (it.cancelled) {
      for (const l of wrap(`  (Cancelled by ${it.cancellation?.by || '-'})`, COLS)) b.line(l)
    }
  }
  b.rule('-')

  b.line(twoCol('Subtotal :', fmtMoney(subtotal)))
  if (tax > 0) b.line(twoCol(`GST (${Math.round(rate * 100)}%) :`, fmtMoney(tax)))
  if (discount > 0) {
    const label = `Discount${order.discount?.percent ? ` ${order.discount.percent}%` : ''}${order.discount?.reason ? ` (${order.discount.reason})` : ''} :`
    b.line(twoCol(label, `- ${fmtMoney(discount)}`))
  }
  b.rule('=')
  b.bold(true).doubleSize(true)
  b.line(twoCol('NET BILL:', fmtMoney(total), COLS))
  b.doubleSize(false).bold(false)
  b.rule('=')

  if (order.complimentary) {
    b.align(1).bold(true)
    b.line('*** COMPLIMENTARY ***')
    b.bold(false)
    b.line(`By ${order.complimentary.orderedBy}${order.complimentary.reason ? ` - ${order.complimentary.reason}` : ''}`)
    b.align(0)
  }

  const paymentModeLabel =
    order.payment === 'Paid' && order.method === 'Online' && order.onlineAccountName
      ? `Online - ${order.onlineAccountName}`
      : order.payment === 'Paid'
        ? order.method
        : order.payment
  b.line(twoCol('Payment Mode :', paymentModeLabel))
  if (order.payment === 'Paid') b.line(twoCol('Cash Received :', fmtMoney(total)))
  if (order.payment === 'Udhaar' && udhaarPaid > 0) {
    b.line(twoCol('Recovered :', `- ${fmtMoney(udhaarPaid)}`))
    b.rule('-')
    b.bold(true).line(twoCol('Balance Due :', fmtMoney(udhaarRemaining))).bold(false)
  }
  if (order.method === 'Online' && order.onlineAccountName) {
    const acct = [order.onlineAccountName, order.onlineAccountBank, order.onlineAccountType].filter(Boolean).join(' - ')
    for (const l of wrap(`Account : ${acct}`, COLS)) b.line(l)
  }
  b.rule('=')

  b.align(1)
  b.bold(true).line('!!!! THANK YOU FOR DINING WITH US !!!!').bold(false)
  b.line('Please visit again')
  b.line('Powered by Softdap')

  b.cut()
  return b.toBytes()
}

// Mirrors KitchenSlips.jsx's HTML docket field-for-field — one slip per
// department (from utils/kot.js's groupOrderItemsByDepartment, shared by
// both print paths so they can't drift on which items land on which
// counter). Each slip ends with its own cut, same as separate physical
// tickets torn off one at a time.
//
// `cashierName` is the currently logged-in user issuing the print (not
// `order.waiter`, a distinct field for the floor waiter serving the
// table) — printed as "Cashier :" rather than the generic "Admin :" a
// style reference used, since Cafe Ali's own role system (Admin/Manager/
// Cashier/Kitchen) makes that the accurate label for who's actually
// running the till.
export function buildKotEscPos({ order, slips, unitOf, tableLabelText, dateStr, timeStr, cashierName }) {
  const b = new ReceiptBuilder()

  const orderNo = (order.id.match(/\d+/) || [order.id])[0]
  const orderTypeLabel =
    Number(order.table) === SPECIAL_TABLE_IDS.delivery
      ? 'DELIVERY'
      : Number(order.table) === SPECIAL_TABLE_IDS.takeaway
        ? 'TAKEAWAY'
        : 'DINE IN'
  // Only delivery orders carry a real customer name in this app's data
  // model (dine-in/takeaway have no name field at all) — "Walking
  // Customer" is the same fallback label used elsewhere for an unnamed
  // walk-in.
  const clientName = order.deliveryCustomerName || 'Walking Customer'

  slips.forEach((g, i) => {
    b.align(1)
    b.bold(true).line('CAFE ALI').bold(false)
    if (order.reprint) b.bold(true).line('*** REPRINT ***').bold(false)
    b.bold(true).doubleSize(true).line(g.name.toUpperCase()).doubleSize(false).bold(false)
    b.bold(true)
    b.box([`Order # ${orderNo}`])
    b.bold(false)
    b.line(orderTypeLabel)

    b.align(0)
    b.line(twoCol('TABLE :', tableLabelText))
    b.line(twoCol('WAITER :', order.waiter || '-'))
    b.line(`${dateStr} - ${timeStr}`)
    b.line(twoCol('Client :', clientName))
    b.rule('-')

    // Sr(3) Item(remainder) Qty(5) — replaces the old 2-column
    // name+qty layout with a numbered table to match the reference style.
    const SR_W = 3
    const QTY_W = 5
    const NAME_W = COLS - SR_W - QTY_W
    b.bold(true)
    b.line(`${padRight('Sr', SR_W)}${padRight('Item', NAME_W)}${padLeft('Qty', QTY_W)}`)
    b.bold(false)
    b.rule('-')

    let totalQty = 0
    g.items.forEach((it, idx) => {
      // Cancelled items print as x0 (kitchen shouldn't prepare them, but
      // the line stays visible for counter awareness) and don't add to
      // the slip's total — same convention the old layout already used
      // for the printed qty label.
      const qty = it.cancelled ? 0 : Number(it.qty) || 0
      totalQty += qty
      const qtyLabel = `x${it.cancelled ? '0' : formatQtyPlain(it.qty, unitOf(it))}`
      const nameLines = wrap(it.name, NAME_W)
      b.bold(true)
      b.line(`${padRight(String(idx + 1), SR_W)}${padRight(nameLines[0], NAME_W)}${padLeft(qtyLabel, QTY_W)}`)
      b.bold(false)
      for (const extra of nameLines.slice(1)) {
        b.line(`${' '.repeat(SR_W)}${padRight(extra, NAME_W)}${' '.repeat(QTY_W)}`)
      }
    })
    b.rule('-')
    b.bold(true)
    b.line(twoCol('Total Qty :', String(totalQty)))
    b.bold(false)
    b.rule('=')

    b.align(1)
    b.bold(true).line(`* ORDER # ${orderNo} *`).bold(false)
    b.line(`Slip ${i + 1} / ${slips.length}`)
    b.rule('-')

    b.align(0)
    b.line(twoCol('Cashier :', cashierName || '-'))
    b.line(twoCol('Cell :', '03132870111'))
    b.line(twoCol('Email :', 'cafealihawksbay@gmail.com'))

    b.cut()
  })

  return b.toBytes()
}

// Plain-ASCII quantity label — same reasoning as fmtMoney above (no Urdu
// digits in raw printer output regardless of app language).
function formatQtyPlain(qty, unit) {
  return unit === 'kg' ? `${(Math.round((Number(qty) || 0) * 100) / 100).toFixed(2)}kg` : String(qty)
}
