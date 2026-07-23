// WhatsApp Cloud API webhook (requirements.md §7: "Admin can request a
// report by messaging the system directly"). Registered on the VPS app
// (src/vps/app.ts), not the local server — Meta requires a publicly
// reachable HTTPS endpoint with a real (non-self-signed) TLS certificate on
// one of a fixed set of ports (443/80/88/8443), which only the VPS has (see
// docs/deployment-setup.md's WhatsApp section for the sslip.io + Let's
// Encrypt setup this needed, since the client didn't want to buy a domain).
//
// Replies using the VPS's own synced data (DailyClosing, via
// whatsapp/report.ts) — the VPS never reaches back to the local server; it
// only ever replays closings that have already been synced to it.
//
// Conversation flow (client feedback: wants a two-step menu — pick a
// closing, THEN pick which report section of that closing to see — instead
// of one merged image): this now needs a small amount of remembered state
// between the two messages ("which closing did this number just pick"),
// which the original design deliberately avoided (a webhook retry, a second
// device messaging at the same time, a restart losing in-memory state were
// all real risks flagged when this file was first written). The trade-off
// is accepted deliberately, scoped as tightly as possible: an in-memory,
// short-TTL (PENDING_TTL_MS) map, keyed by sender, holding nothing but a
// closing id. Worst case if it's lost (restart, TTL expiry, a race between
// two devices) is simply falling back to the step-1 menu again — never a
// wrong report sent to the wrong person, since step 2 is re-validated
// against a freshly loaded closing every time, not a cached one.
//
// Any inbound text that isn't a bare number always resets to the step-1
// (closing) menu, dropping any pending selection — same "always show a
// sane menu" fallback the original stateless design had.

import type { FastifyInstance } from 'fastify'
import { env } from '../env.js'
import {
  listRecentClosingDays,
  loadClosingById,
  sendClosingSection,
  dateLabelUr,
  timeLabelUr,
  type ClosingDayGroup,
  type ReportSection,
} from './report.js'
import { sendTextMessage } from './client.js'

interface InboundMessage {
  from: string
  type: string
  text?: { body?: string }
}

interface WebhookPayload {
  entry?: {
    changes?: {
      field?: string
      value?: { messages?: InboundMessage[] }
    }[]
  }[]
}

function extractMessages(payload: WebhookPayload): InboundMessage[] {
  const messages: InboundMessage[] = []
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      for (const m of change.value?.messages ?? []) messages.push(m)
    }
  }
  return messages
}

// Step 1 — "which closing" — keyed by sender, holding just the closing id
// picked, so step 2 knows which report to load. Cleared on selection,
// on an invalid/expired lookup, or on any non-numeric message.
const PENDING_TTL_MS = 10 * 60 * 1000
const pendingSelection = new Map<string, { closingId: string; expiresAt: number }>()

function getPending(from: string): string | null {
  const entry = pendingSelection.get(from)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    pendingSelection.delete(from)
    return null
  }
  return entry.closingId
}

function setPending(from: string, closingId: string): void {
  pendingSelection.set(from, { closingId, expiresAt: Date.now() + PENDING_TTL_MS })
}

function clearPending(from: string): void {
  pendingSelection.delete(from)
}

// Flattens the day-grouped list into one numbered sequence (day headings
// aren't selectable, only the closings under them) — the *displayed* order
// is exactly the *selectable* order, so "type 3" always means the 3rd line
// with a number next to it.
function flattenClosingIds(days: ClosingDayGroup[]): string[] {
  return days.flatMap((d) => d.closings.map((c) => c.id))
}

function buildClosingMenuText(days: ClosingDayGroup[]): string {
  let n = 0
  const lines: string[] = []
  for (const day of days) {
    lines.push(`\n*${day.dayNameUr} — ${dateLabelUr(day.date)}*`)
    for (const c of day.closings) {
      n += 1
      lines.push(`${n}. ${timeLabelUr(c.closingTime)}`)
    }
  }
  return `سلام! 👋\nکون سی کلوزنگ دیکھنی ہے؟ نمبر لکھ کر بھیجیں:\n${lines.join('\n')}`
}

const REPORT_SECTIONS: { key: Exclude<ReportSection, 'all'>; label: string }[] = [
  { key: 'summary', label: 'خلاصہ' },
  { key: 'ledgers', label: 'اکاؤنٹ لیجرز' },
  { key: 'cancelled', label: 'کینسل بل' },
  { key: 'complimentary', label: 'آفشل بل' },
]
const ALL_SECTIONS_OPTION = REPORT_SECTIONS.length + 1 // 5

function buildSectionMenuText(): string {
  const lines = REPORT_SECTIONS.map((s, i) => `${i + 1}. ${s.label}`)
  lines.push(`${ALL_SECTIONS_OPTION}. تمام رپورٹس بھیجیں`)
  return `کون سی رپورٹ دیکھنی ہے؟ نمبر لکھ کر بھیجیں:\n\n${lines.join('\n')}`
}

async function handleInboundMessage(msg: InboundMessage): Promise<void> {
  if (!env.whatsapp.reportRecipients.includes(msg.from)) {
    // Not the configured admin number — the test-mode WhatsApp number can
    // only receive from its own small allow-listed recipient set anyway,
    // but this is the real authorization boundary: don't hand out business
    // figures to whoever else can reach this number.
    return
  }

  // A real failure here (surfaced once: Meta returned a raw "Service
  // Unavailable" instead of JSON on an image upload, which crashed the send
  // — see client.ts's graphRequest fix) used to vanish into the outer
  // catch-all with nothing sent back at all. The admin has no way to
  // distinguish "still processing" from "silently broken" without some
  // reply, so failures now get a best-effort Urdu notice instead of dead
  // air — if even that fails, there's genuinely nothing more to do from here.
  try {
    await respond(msg)
  } catch (err) {
    try {
      await sendTextMessage(msg.from, 'معذرت، رپورٹ بھیجنے میں مسئلہ ہوا۔ دوبارہ کوشش کریں۔')
    } catch {
      /* best-effort only */
    }
    throw err // still logged by the caller
  }
}

// Step 1 — always recomputed fresh from "recent closings right now" (never
// cached), so a slow reply or a race with a second device can't show a menu
// that's already gone stale.
async function sendClosingMenu(from: string): Promise<void> {
  const days = await listRecentClosingDays()
  if (days.length === 0) {
    await sendTextMessage(from, 'ابھی تک کوئی کلوزنگ رپورٹ محفوظ نہیں ہوئی۔')
    return
  }
  await sendTextMessage(from, buildClosingMenuText(days))
}

// Step 2 — a report-section number, against whichever closing step 1 left
// pending for this sender. Always reloads the closing fresh (never trusts a
// cached report), so even a stale/edge-case pending entry can only ever
// point at a real, current closing or fail closed into "load it again."
async function handleSectionSelection(from: string, closingId: string, selection: number): Promise<void> {
  const loaded = await loadClosingById(closingId)
  if (!loaded) {
    // The pending closing id no longer resolves (deleted, or this process
    // restarted and lost real backing data some other way) — fall back to
    // the top-level menu rather than erroring.
    clearPending(from)
    await sendClosingMenu(from)
    return
  }

  if (selection === ALL_SECTIONS_OPTION) {
    clearPending(from)
    await sendTextMessage(from, 'رپورٹس بھیجی جا رہی ہیں...')
    await sendClosingSection(from, loaded, 'all')
    return
  }

  const chosen = REPORT_SECTIONS[selection - 1]
  if (!chosen) {
    await sendTextMessage(from, `معذرت، درست نمبر لکھیں۔\n\n${buildSectionMenuText()}`)
    return
  }

  clearPending(from)
  const sentCount = await sendClosingSection(from, loaded, chosen.key)
  if (sentCount === 0) {
    // A real, empty section (e.g. no cancelled orders that day) — say so
    // rather than sending nothing with no explanation.
    await sendTextMessage(from, `اس دن کے لیے "${chosen.label}" میں کوئی انٹری نہیں ملی۔`)
  }
}

async function respond(msg: InboundMessage): Promise<void> {
  const body = (msg.text?.body ?? '').trim()
  const selection = /^\d+$/.test(body) ? Number(body) : null
  const pendingClosingId = selection != null ? getPending(msg.from) : null

  // Step 2: a pending closing selection exists and this is a number — treat
  // it as a report-section pick against that closing.
  if (selection != null && pendingClosingId) {
    await handleSectionSelection(msg.from, pendingClosingId, selection)
    return
  }

  // Step 1: no pending selection, or a non-numeric message (which always
  // resets to the top-level menu, dropping any pending selection).
  clearPending(msg.from)
  const days = await listRecentClosingDays()
  if (days.length === 0) {
    await sendTextMessage(msg.from, 'ابھی تک کوئی کلوزنگ رپورٹ محفوظ نہیں ہوئی۔')
    return
  }

  if (selection == null) {
    // Any non-numeric message (including a first "hi") shows the menu.
    await sendTextMessage(msg.from, buildClosingMenuText(days))
    return
  }

  const flatIds = flattenClosingIds(days)
  const pickedId = flatIds[selection - 1]
  if (!pickedId) {
    await sendTextMessage(msg.from, `معذرت، درست نمبر لکھیں۔\n\n${buildClosingMenuText(days)}`)
    return
  }

  setPending(msg.from, pickedId)
  await sendTextMessage(msg.from, buildSectionMenuText())
}

export function registerWhatsappWebhook(app: FastifyInstance): void {
  // Meta's one-time verification handshake when the callback URL is
  // registered/changed in the App Dashboard — echoes hub.challenge back only
  // if hub.verify_token matches what we told Meta to expect.
  app.get('/webhook/whatsapp', async (req, reply) => {
    const q = req.query as Record<string, string>
    if (q['hub.mode'] === 'subscribe' && env.whatsapp.webhookVerifyToken && q['hub.verify_token'] === env.whatsapp.webhookVerifyToken) {
      return reply.code(200).send(q['hub.challenge'])
    }
    return reply.code(403).send('Verification failed.')
  })

  // Inbound message delivery. Always 200s quickly (Meta retries/backs off
  // aggressively on non-2xx) — any failure here is logged, not surfaced to
  // Meta as a webhook failure, since there's no useful retry semantics for
  // "we couldn't render an image."
  app.post('/webhook/whatsapp', async (req, reply) => {
    reply.code(200).send('EVENT_RECEIVED') // ack immediately, process after
    try {
      const messages = extractMessages(req.body as WebhookPayload)
      for (const msg of messages) await handleInboundMessage(msg)
    } catch (err) {
      req.log.error(err, '[whatsapp-webhook] failed to process inbound message')
    }
  })
}
