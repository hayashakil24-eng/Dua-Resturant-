// Manages the "which WhatsApp numbers can we actually send to" list — see
// schema.prisma's WhatsappRecipient comment for why this exists at all: Meta's
// Cloud API has no endpoint to list a test-mode app's allowed-recipient
// allowlist, so the only way to know if a number is on it is to actually try
// sending and read the result. Capped at 5 rows here (Meta's own test-mode
// limit), not a schema constraint.

import { prisma } from '../db/client.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'
import { sendTextMessage, WhatsAppApiError, META_RECIPIENT_NOT_ALLOWED_CODE } from '../whatsapp/client.js'

interface Ctx {
  actor: Actor
}

const MAX_RECIPIENTS = 5
const VERIFY_MESSAGE = 'Cafe Ali: this number has been added to receive WhatsApp reports and messages from your restaurant system.'

export async function listWhatsappRecipients() {
  return prisma.whatsappRecipient.findMany({ orderBy: { createdAt: 'asc' } })
}

function normalizePhone(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '')
}

// Attempts a real send and classifies the result — success means Meta
// genuinely delivered (or queued) it, so the number is confirmed on the
// allow-list; a 131030 means it specifically isn't; anything else (network
// blip, bad token, rate limit) is a real error the caller should surface as
// such rather than silently recording as "not added."
async function verify(phone: string): Promise<{ verified: boolean; error: string | null }> {
  try {
    await sendTextMessage(phone, VERIFY_MESSAGE)
    return { verified: true, error: null }
  } catch (err) {
    if (err instanceof WhatsAppApiError && err.code === META_RECIPIENT_NOT_ALLOWED_CODE) {
      return { verified: false, error: 'Not added on Meta’s dashboard yet.' }
    }
    throw err
  }
}

export async function addWhatsappRecipient(ctx: Ctx, input: { phone?: string; label?: string }) {
  const phone = normalizePhone(input.phone ?? '')
  if (phone.length < 8) throw new ServiceError('Enter a valid WhatsApp number, digits only (e.g. 923001234567).')
  const label = String(input.label ?? '').trim() || null

  const existing = await prisma.whatsappRecipient.findUnique({ where: { phone } })
  if (existing) throw new ServiceError('This number has already been added.')

  const count = await prisma.whatsappRecipient.count()
  if (count >= MAX_RECIPIENTS) {
    throw new ServiceError(`Meta allows at most ${MAX_RECIPIENTS} test-mode numbers. Remove one before adding another.`)
  }

  const { verified, error } = await verify(phone)
  const now = new Date()
  const recipient = await prisma.$transaction(async (tx) => {
    const row = await tx.whatsappRecipient.create({
      data: { phone, label, verified, verifiedAt: verified ? now : null, lastCheckedAt: now, lastError: error },
    })
    await writeAudit(tx, { action: 'WHATSAPP_RECIPIENT_ADDED', actor: ctx.actor, details: { phone, verified } })
    return row
  })
  return recipient
}

// Re-tests an already-added-but-not-yet-verified number — the admin's own
// workflow is: add here (likely unverified), go add it on Meta's dashboard,
// come back and recheck rather than delete + re-add.
export async function recheckWhatsappRecipient(ctx: Ctx, id: string) {
  const existing = await prisma.whatsappRecipient.findUnique({ where: { id } })
  if (!existing) throw new ServiceError('Recipient not found.', 404)

  const { verified, error } = await verify(existing.phone)
  const now = new Date()
  return prisma.$transaction(async (tx) => {
    const updated = await tx.whatsappRecipient.update({
      where: { id },
      data: { verified, verifiedAt: verified ? now : existing.verifiedAt, lastCheckedAt: now, lastError: error },
    })
    await writeAudit(tx, { action: 'WHATSAPP_RECIPIENT_RECHECKED', actor: ctx.actor, details: { phone: existing.phone, verified } })
    return updated
  })
}

export async function removeWhatsappRecipient(ctx: Ctx, id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.whatsappRecipient.findUnique({ where: { id } })
    if (!existing) throw new ServiceError('Recipient not found.', 404)
    await tx.whatsappRecipient.delete({ where: { id } })
    await writeAudit(tx, { action: 'WHATSAPP_RECIPIENT_REMOVED', actor: ctx.actor, details: { phone: existing.phone } })
    return { ok: true }
  })
}
