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
// Conversation flow (client feedback: wants a numbered menu, not just
// always-the-latest-report) is deliberately stateless — no session/"what
// did we last show this user" storage. Any inbound text that isn't a bare
// number re-shows the menu; a bare number is interpreted against a freshly
// recomputed list of recent closings. This avoids the class of bug where
// stored conversation state goes stale (a webhook retry, a second device
// messaging at the same time, a restart losing in-memory state) — the menu
// is always exactly what "recent closings right now" actually is.

import type { FastifyInstance } from 'fastify'
import { env } from '../env.js'
import { listRecentClosings, sendClosingReportById } from './report.js'
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

function buildMenuText(closings: { dayNameUr: string; date: string }[]): string {
  const lines = closings.map((c, i) => `${i + 1}. ${c.dayNameUr} — ${c.date}`)
  const allOptionNumber = closings.length + 1
  lines.push(`${allOptionNumber}. تمام رپورٹس بھیجیں`)
  return `سلام! 👋\nکون سی رپورٹ چاہیے؟ نیچے دیے گئے نمبر میں سے کوئی ایک لکھ کر بھیجیں:\n\n${lines.join('\n')}`
}

async function handleInboundMessage(msg: InboundMessage): Promise<void> {
  if (!env.whatsapp.reportRecipient || msg.from !== env.whatsapp.reportRecipient) {
    // Not the configured admin number — the test-mode WhatsApp number can
    // only receive from its own small allow-listed recipient set anyway,
    // but this is the real authorization boundary: don't hand out business
    // figures to whoever else can reach this number.
    return
  }

  const closings = await listRecentClosings()
  if (closings.length === 0) {
    await sendTextMessage(msg.from, 'ابھی تک کوئی کلوزنگ رپورٹ محفوظ نہیں ہوئی۔')
    return
  }

  const body = (msg.text?.body ?? '').trim()
  const selection = /^\d+$/.test(body) ? Number(body) : null
  const allOptionNumber = closings.length + 1

  if (selection == null) {
    // Any non-numeric message (including a first "hi") shows the menu.
    await sendTextMessage(msg.from, buildMenuText(closings))
    return
  }

  if (selection === allOptionNumber) {
    await sendTextMessage(msg.from, `${closings.length} رپورٹس بھیجی جا رہی ہیں...`)
    for (const c of closings) await sendClosingReportById(msg.from, c.id)
    return
  }

  if (selection >= 1 && selection <= closings.length) {
    await sendClosingReportById(msg.from, closings[selection - 1]!.id)
    return
  }

  await sendTextMessage(msg.from, `معذرت، درست نمبر لکھیں۔\n\n${buildMenuText(closings)}`)
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
