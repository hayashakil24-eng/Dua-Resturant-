// Field rules for the online payment accounts in Settings — which fields a
// given account type needs, and whether what was entered is acceptable.
// Kept textually parallel with frontend/src/utils/accountNumber.js — the UI
// sanitizes as the cashier types, this module is the enforced source of truth.

export const WALLET_TYPES = ['JazzCash', 'Easypaisa', 'SadaPay', 'NayaPay']
// Wallets that are also digital banks: they issue a PK IBAN alongside the
// mobile number, so a customer may pay to either.
export const DIGITAL_WALLET_TYPES = ['SadaPay', 'NayaPay']
export const BANK_TYPE = 'Bank Account'

export const ERR_WALLET = 'Account number must be exactly 11 digits.'
export const ERR_BANK =
  'Bank account must be 10, 14 or 16 digits, or a 24-character IBAN starting with PK.'

// Longest accepted bank value: a Pakistani IBAN (PK + 2 check digits + 20).
const BANK_MAX = 24
const WALLET_LEN = 11

const IBAN_PK = /^PK\d{2}[A-Z0-9]{20}$/

export const BANK_OTHER = 'Other'

// Offered in the Bank Name dropdown; 'Other' stays last and lets the user type
// a bank that isn't listed.
export const PK_BANKS = [
  'Al Baraka Bank',
  'Allied Bank',
  'Askari Bank',
  'Bank Alfalah',
  'Bank of Punjab',
  'BankIslami',
  'Dubai Islamic Bank',
  'Faysal Bank',
  'Habib Bank (HBL)',
  'Habib Metropolitan Bank',
  'JS Bank',
  'MCB Bank',
  'Meezan Bank',
  'National Bank of Pakistan',
  'Silkbank',
  'Sindh Bank',
  'Soneri Bank',
  'Standard Chartered',
  'Summit Bank',
  'United Bank (UBL)',
  BANK_OTHER,
]

export type AccountFields = {
  numberLabelKey: 'mobileNumber' | 'accountNumberIban' | 'accountNumber'
  numberRequired: boolean
  needsBank: boolean
  showsIban: boolean
}

// The one answer to "what does this type need?" — the form, the list row and
// the server all read it, so a type's shape is never described twice.
export function accountFieldsFor(type: string): AccountFields {
  if (WALLET_TYPES.includes(type))
    return {
      numberLabelKey: 'mobileNumber',
      numberRequired: true,
      needsBank: false,
      showsIban: DIGITAL_WALLET_TYPES.includes(type),
    }
  if (type === BANK_TYPE)
    return { numberLabelKey: 'accountNumberIban', numberRequired: true, needsBank: true, showsIban: false }
  return { numberLabelKey: 'accountNumber', numberRequired: false, needsBank: false, showsIban: false }
}

// Strips whatever the selected type can never contain and caps the length, so
// a number that only differs by spacing/dashes is stored in one canonical form.
export function sanitizeAccountNumber(type: string, raw: unknown): string {
  const value = String(raw ?? '')
  if (WALLET_TYPES.includes(type)) return value.replace(/\D/g, '').slice(0, WALLET_LEN)
  if (type === BANK_TYPE) return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, BANK_MAX)
  return value.trim()
}

export function sanitizeIban(raw: unknown): string {
  return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, BANK_MAX)
}

// Returns '' when the number is acceptable, otherwise the reason to reject it.
// Emptiness is not this function's business — validateAccount decides which
// types may leave it blank.
export function validateAccountNumber(type: string, value: unknown): string {
  const v = String(value ?? '').trim()
  if (!v) return ''
  if (WALLET_TYPES.includes(type)) return /^\d{11}$/.test(v) ? '' : ERR_WALLET
  if (type === BANK_TYPE) {
    const digits = /^(\d{10}|\d{14}|\d{16})$/.test(v)
    return digits || IBAN_PK.test(v) ? '' : ERR_BANK
  }
  return ''
}

export function validateIban(value: unknown): string {
  const v = sanitizeIban(value)
  if (!v) return ''
  return IBAN_PK.test(v) ? '' : 'errIbanFormat'
}

export type AccountInput = { type?: string; name?: string; number?: string; bankName?: string; iban?: string }

// Whole-record check. Returns '' or an error key, so the frontend can
// translate it and the backend can map it to its own English message.
export function validateAccount(input: AccountInput): string {
  const type = (input.type ?? '').trim() || 'Other'
  const fields = accountFieldsFor(type)
  if (!String(input.name ?? '').trim()) return 'errNameRequired'
  if (fields.needsBank && !String(input.bankName ?? '').trim()) return 'errBankRequired'
  const number = sanitizeAccountNumber(type, input.number ?? '')
  if (fields.numberRequired && !number) return 'errNumberRequired'
  const badNumber = validateAccountNumber(type, number)
  if (badNumber) return badNumber === ERR_WALLET ? 'errNumberWallet' : 'errNumberBank'
  if (fields.showsIban) return validateIban(input.iban ?? '')
  return ''
}
