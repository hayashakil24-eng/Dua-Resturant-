// Thin wrapper over the Meta WhatsApp Cloud API (requirements.md §7: "Use the
// official Meta WhatsApp Cloud API — reliable, no risk of being banned").
// Credentials are optional everywhere they're read (same pattern as env.vps.*)
// so a deployment that never configures WhatsApp just never sends — no crash
// at boot, no dummy values needed for tests.
//
// Images are sent via upload-then-reference (POST .../media, then send with
// that media id) rather than the `link` parameter — the report is generated
// fresh on a server that may have no stable public URL (the local server
// almost certainly doesn't; even the VPS's is a raw IP), so handing WhatsApp
// a URL to fetch isn't reliable. Uploading the bytes directly works
// regardless of network topology.

import { env } from '../env.js'

const GRAPH_VERSION = 'v21.0'

function apiUrl(path: string): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${path}`
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(env.whatsapp.phoneNumberId && env.whatsapp.accessToken)
}

// Meta occasionally answers with a plain-text error ("Service Unavailable",
// a raw 5xx from their edge, etc.) instead of a JSON error body — this
// surfaced for real (uploadMedia against a fresh app, right after its
// webhook was (re-)registered) as an unhandled `res.json()` SyntaxError that
// crashed the whole send silently into the webhook's catch-all, so the
// caller never learned an image failed to send at all. Read the body as
// text first, always, so a non-JSON response becomes a clear error message
// instead of a parse crash either way.
async function graphRequest<T>(path: string, init: RequestInit, attempt = 0): Promise<T> {
  if (!isWhatsAppConfigured()) throw new Error('WhatsApp Cloud API is not configured (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN).')
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${env.whatsapp.accessToken}` },
  })
  const text = await res.text()
  let body: (T & { error?: { message?: string } }) | undefined
  try {
    body = JSON.parse(text)
  } catch {
    // Not JSON — a raw 5xx/edge error page. Retry once for exactly this
    // case (transient upstream hiccup, not a real API error we'd want to
    // surface verbatim), then give up with the raw text as the message.
    if (res.status >= 500 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
      return graphRequest<T>(path, init, attempt + 1)
    }
    throw new Error(`WhatsApp API error (${res.status}, non-JSON response): ${text.slice(0, 300)}`)
  }
  if (!res.ok) {
    throw new Error(`WhatsApp API error (${res.status}): ${body?.error?.message ?? text.slice(0, 300)}`)
  }
  return body as T
}

// Uploads image bytes to the phone number's own media store, returns a media
// id valid for a short window — meant to be used immediately by
// sendImageMessage, not cached/reused later.
export async function uploadMedia(bytes: Buffer, filename: string, mimeType: string): Promise<string> {
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('file', new Blob([bytes], { type: mimeType }), filename)
  const result = await graphRequest<{ id: string }>(`${env.whatsapp.phoneNumberId}/media`, { method: 'POST', body: form })
  return result.id
}

// `to` is digits-only, no leading +, per the Cloud API's own convention
// (e.g. "923001234567").
export async function sendImageMessage(to: string, mediaId: string, caption?: string): Promise<void> {
  await graphRequest(`${env.whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: { id: mediaId, ...(caption ? { caption } : {}) },
    }),
  })
}

export async function sendTextMessage(to: string, body: string): Promise<void> {
  await graphRequest(`${env.whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  })
}

// Convenience: render bytes -> upload -> send, the shape both the schedule
// job and the webhook reply actually want.
export async function sendReportImage(to: string, png: Buffer, caption?: string): Promise<void> {
  const mediaId = await uploadMedia(png, 'daily-closing-report.png', 'image/png')
  await sendImageMessage(to, mediaId, caption)
}
