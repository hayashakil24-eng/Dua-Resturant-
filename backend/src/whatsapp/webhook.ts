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
// only ever replays the most recent closing that's already been synced to it.

import type { FastifyInstance } from 'fastify'
import { env } from '../env.js'
import { sendLatestClosingReport, loadLatestClosing } from './report.js'
import { sendTextMessage } from './client.js'

interface InboundMessage {
  from: string
  type: string
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
      for (const msg of messages) {
        if (!env.whatsapp.reportRecipient || msg.from !== env.whatsapp.reportRecipient) {
          // Not the configured admin number — the test-mode WhatsApp number
          // can only receive from its own small allow-listed recipient set
          // anyway, but this is the real authorization boundary: don't hand
          // out business figures to whoever else can reach this number.
          continue
        }
        const latest = await loadLatestClosing()
        if (!latest) {
          await sendTextMessage(msg.from, 'No closing report has been saved yet.')
          continue
        }
        await sendLatestClosingReport(msg.from)
      }
    } catch (err) {
      req.log.error(err, '[whatsapp-webhook] failed to process inbound message')
    }
  })
}
