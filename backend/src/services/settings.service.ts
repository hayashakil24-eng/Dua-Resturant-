// App settings (GST toggle + rate) and online payment accounts — port of
// AppContext.jsx's setGst/setGstRate and addOnlineAccount/updateOnlineAccount/
// toggleOnlineAccount. GST rate is stored as a fraction (0.05 = 5%); the API
// takes/returns a percentage the way the Settings UI does. Online accounts are
// deactivated, never deleted, so historical orders referencing them still
// resolve (matches the no-hard-delete rule).

import { prisma } from '../db/client.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'
import {
  ERR_BANK,
  ERR_WALLET,
  accountFieldsFor,
  sanitizeAccountNumber,
  sanitizeIban,
  validateAccount,
} from '../core/onlineAccount.js'

interface Ctx {
  actor: Actor
}
const SETTINGS_ID = 'singleton'

async function ensureSettings() {
  return prisma.appSettings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID }, update: {} })
}

export async function getSettings() {
  return ensureSettings()
}

export async function setGst(ctx: Ctx, enabled: boolean) {
  const next = Boolean(enabled)
  return prisma.$transaction(async (tx) => {
    const cur = await tx.appSettings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID }, update: {} })
    if (cur.gstEnabled === next) return cur // no-op, no phantom audit
    const updated = await tx.appSettings.update({ where: { id: SETTINGS_ID }, data: { gstEnabled: next } })
    await writeAudit(tx, { action: next ? 'GST_ENABLED' : 'GST_DISABLED', actor: ctx.actor, details: {} })
    return updated
  })
}

// Accepts a percentage (e.g. 10 → stored 0.10). Rejects out-of-range, no-ops if
// unchanged. Keeps up to 2 decimals of a percent, same as the frontend.
export async function setGstRate(ctx: Ctx, pct: number) {
  const n = Number(pct)
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new ServiceError('Enter a GST rate between 0 and 100.')
  const frac = Math.round(n * 100) / 10000
  return prisma.$transaction(async (tx) => {
    const cur = await tx.appSettings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID }, update: {} })
    if (cur.gstRate === frac) return cur
    const updated = await tx.appSettings.update({ where: { id: SETTINGS_ID }, data: { gstRate: frac } })
    await writeAudit(tx, { action: 'GST_RATE_CHANGED', actor: ctx.actor, details: { rate: `${n}%` } })
    return updated
  })
}

// ---- WhatsApp daily report (requirements.md §6/§7) -------------------------

export interface WhatsappReportConfig {
  enabled?: boolean
  hour?: number
  recipient?: string | null
}

export async function setWhatsappReportConfig(ctx: Ctx, patch: WhatsappReportConfig) {
  const data: Record<string, unknown> = {}
  if (patch.enabled != null) data.whatsappReportEnabled = Boolean(patch.enabled)
  if (patch.hour != null) {
    const h = Number(patch.hour)
    if (!Number.isInteger(h) || h < 0 || h > 23) throw new ServiceError('Enter an hour between 0 and 23.')
    data.whatsappReportHour = h
  }
  if (patch.recipient !== undefined) {
    // WhatsApp Cloud API wants digits only, no leading + or punctuation.
    const digits = String(patch.recipient ?? '').replace(/\D/g, '')
    if (patch.recipient && digits.length < 8) throw new ServiceError('Enter a valid WhatsApp number, digits only (e.g. 923001234567).')
    data.whatsappReportRecipient = digits || null
  }
  if (Object.keys(data).length === 0) return ensureSettings()
  return prisma.$transaction(async (tx) => {
    await tx.appSettings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID }, update: {} })
    const updated = await tx.appSettings.update({ where: { id: SETTINGS_ID }, data })
    await writeAudit(tx, { action: 'WHATSAPP_REPORT_CONFIG_CHANGED', actor: ctx.actor, details: data })
    return updated
  })
}

// ---- Online accounts ------------------------------------------------------

export async function listOnlineAccounts() {
  return prisma.onlineAccount.findMany({ orderBy: { name: 'asc' } })
}

// validateAccount returns a key so the frontend can translate it; the API
// answers in English, the way every other ServiceError here does.
const ACCOUNT_ERRORS: Record<string, string> = {
  errNameRequired: 'Account name is required.',
  errBankRequired: 'Bank name is required for a bank account.',
  errNumberRequired: 'Account number is required.',
  errNumberWallet: ERR_WALLET,
  errNumberBank: ERR_BANK,
  errIbanFormat: 'IBAN must be 24 characters starting with PK.',
}

function accountError(key: string): ServiceError {
  return new ServiceError(ACCOUNT_ERRORS[key] ?? 'Account details are invalid.')
}

type AccountFieldsInput = { name?: string; type?: string; number?: string; bankName?: string; iban?: string; nameUrdu?: string }

// Fields a type doesn't use are stored as null rather than kept — otherwise a
// bank account switched to JazzCash would silently keep its old bank name.
function accountColumns(input: { type: string; number?: string; bankName?: string; iban?: string }) {
  const fields = accountFieldsFor(input.type)
  return {
    type: input.type,
    number: sanitizeAccountNumber(input.type, input.number ?? '') || null,
    bankName: fields.needsBank ? String(input.bankName ?? '').trim() || null : null,
    iban: fields.showsIban ? sanitizeIban(input.iban ?? '') || null : null,
  }
}

export async function addOnlineAccount(ctx: Ctx, input: AccountFieldsInput) {
  const name = (input.name ?? '').trim()
  const type = (input.type ?? '').trim() || 'Other'
  const invalid = validateAccount({ ...input, name, type })
  if (invalid) throw accountError(invalid)
  return prisma.$transaction(async (tx) => {
    const all = await tx.onlineAccount.findMany({ select: { name: true } })
    if (all.some((a) => a.name.toLowerCase() === name.toLowerCase())) throw new ServiceError('An account with this name already exists.')
    const account = await tx.onlineAccount.create({
      data: {
        name,
        ...accountColumns({ ...input, type }),
        nameUrdu: (input.nameUrdu ?? '').trim() || null,
        active: true,
      },
    })
    await writeAudit(tx, { action: 'ONLINE_ACCOUNT_ADDED', actor: ctx.actor, details: { account: account.name } })
    return account
  })
}

export async function updateOnlineAccount(ctx: Ctx, id: string, patch: AccountFieldsInput) {
  const cleanName = patch.name != null ? String(patch.name).trim() : null
  return prisma.$transaction(async (tx) => {
    const existing = await tx.onlineAccount.findUnique({ where: { id } })
    if (!existing) throw new ServiceError('Account not found.', 404)
    if (cleanName) {
      const all = await tx.onlineAccount.findMany({ where: { NOT: { id } }, select: { name: true } })
      if (all.some((a) => a.name.toLowerCase() === cleanName.toLowerCase())) throw new ServiceError('An account with this name already exists.')
    }
    // A patch may carry only some fields, so validate the row as it will end up
    // rather than the fragment that was sent.
    const merged = {
      name: cleanName ?? existing.name,
      type: patch.type != null ? patch.type : existing.type,
      number: patch.number != null ? patch.number : existing.number ?? '',
      bankName: patch.bankName != null ? patch.bankName : existing.bankName ?? '',
      iban: patch.iban != null ? patch.iban : existing.iban ?? '',
    }
    const invalid = validateAccount(merged)
    if (invalid) throw accountError(invalid)
    const data: Record<string, unknown> = { name: merged.name, ...accountColumns(merged) }
    if (patch.nameUrdu != null) data.nameUrdu = String(patch.nameUrdu).trim() || null
    const updated = await tx.onlineAccount.update({ where: { id }, data })
    await writeAudit(tx, { action: 'ONLINE_ACCOUNT_UPDATED', actor: ctx.actor, details: { accountId: id } })
    return updated
  })
}

export async function toggleOnlineAccount(ctx: Ctx, id: string) {
  return prisma.$transaction(async (tx) => {
    const acc = await tx.onlineAccount.findUnique({ where: { id } })
    if (!acc) throw new ServiceError('Account not found.', 404)
    const updated = await tx.onlineAccount.update({ where: { id }, data: { active: !acc.active } })
    await writeAudit(tx, { action: 'ONLINE_ACCOUNT_TOGGLED', actor: ctx.actor, details: { accountId: id } })
    return updated
  })
}
