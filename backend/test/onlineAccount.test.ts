import { describe, expect, it } from 'vitest'
import {
  BANK_TYPE,
  DIGITAL_WALLET_TYPES,
  ERR_BANK,
  ERR_WALLET,
  WALLET_TYPES,
  accountFieldsFor,
  sanitizeAccountNumber,
  sanitizeIban,
  validateAccount,
  validateAccountNumber,
  validateIban,
} from '../src/core/onlineAccount.js'

// Pure unit tests — no DB. Mirrors frontend/src/utils/accountNumber.js, which
// must stay in step with this module.

describe('validateAccountNumber — wallet types', () => {
  for (const type of WALLET_TYPES) {
    it(`${type}: accepts exactly 11 digits`, () => {
      expect(validateAccountNumber(type, '03001234567')).toBe('')
    })
    it(`${type}: rejects 10 and 12 digits`, () => {
      expect(validateAccountNumber(type, '0300123456')).toBe(ERR_WALLET)
      expect(validateAccountNumber(type, '030012345678')).toBe(ERR_WALLET)
    })
    it(`${type}: rejects letters`, () => {
      expect(validateAccountNumber(type, '0300abc4567')).toBe(ERR_WALLET)
    })
  }
})

describe('validateAccountNumber — bank accounts', () => {
  it('accepts 10, 14 and 16 digit account numbers', () => {
    expect(validateAccountNumber(BANK_TYPE, '1234567890')).toBe('')
    expect(validateAccountNumber(BANK_TYPE, '12345678901234')).toBe('')
    expect(validateAccountNumber(BANK_TYPE, '1234567890123456')).toBe('')
  })

  it('accepts a 24-character Pakistani IBAN', () => {
    expect(validateAccountNumber(BANK_TYPE, 'PK36SCBL0000001123456702')).toBe('')
  })

  it('rejects lengths that match no local format', () => {
    expect(validateAccountNumber(BANK_TYPE, '03001234567')).toBe(ERR_BANK)
    expect(validateAccountNumber(BANK_TYPE, '1234567890123')).toBe(ERR_BANK)
  })

  it('rejects a malformed IBAN', () => {
    expect(validateAccountNumber(BANK_TYPE, 'PK36SCBL000000112345670')).toBe(ERR_BANK) // 23 chars
    expect(validateAccountNumber(BANK_TYPE, 'XX36SCBL0000001123456702')).toBe(ERR_BANK)
  })
})

describe('validateAccountNumber — other / empty', () => {
  it('accepts any text for Other', () => {
    expect(validateAccountNumber('Other', 'paypal.me/cafeali')).toBe('')
  })

  it('treats an empty number as valid for every type', () => {
    for (const type of [...WALLET_TYPES, BANK_TYPE, 'Other']) {
      expect(validateAccountNumber(type, '')).toBe('')
      expect(validateAccountNumber(type, '   ')).toBe('')
    }
  })
})

describe('sanitizeAccountNumber', () => {
  it('strips separators and caps wallet numbers at 11 digits', () => {
    expect(sanitizeAccountNumber('JazzCash', '0300-123 4567')).toBe('03001234567')
    expect(sanitizeAccountNumber('JazzCash', '0300123456789')).toBe('03001234567')
    expect(sanitizeAccountNumber('Easypaisa', 'abc0300')).toBe('0300')
  })

  it('uppercases and caps bank values at 24 characters', () => {
    expect(sanitizeAccountNumber(BANK_TYPE, 'pk36 scbl 0000 0011 2345 6702')).toBe('PK36SCBL0000001123456702')
    expect(sanitizeAccountNumber(BANK_TYPE, 'PK36SCBL0000001123456702999')).toBe('PK36SCBL0000001123456702')
  })

  it('leaves Other untouched apart from trimming', () => {
    expect(sanitizeAccountNumber('Other', '  cafe-ali@bank  ')).toBe('cafe-ali@bank')
  })

  it('produces a value that then passes validation', () => {
    const cleaned = sanitizeAccountNumber('SadaPay', '0300 123 4567')
    expect(validateAccountNumber('SadaPay', cleaned)).toBe('')
  })
})

describe('accountFieldsFor', () => {
  it('labels wallets as a mobile number and requires it', () => {
    for (const type of WALLET_TYPES) {
      const f = accountFieldsFor(type)
      expect(f.numberLabelKey).toBe('mobileNumber')
      expect(f.numberRequired).toBe(true)
      expect(f.needsBank).toBe(false)
    }
  })

  it('offers an IBAN only for the digital banks', () => {
    for (const type of WALLET_TYPES) {
      expect(accountFieldsFor(type).showsIban).toBe(DIGITAL_WALLET_TYPES.includes(type))
    }
    expect(accountFieldsFor(BANK_TYPE).showsIban).toBe(false)
  })

  it('asks a bank account for a bank name and a required number', () => {
    expect(accountFieldsFor(BANK_TYPE)).toEqual({
      numberLabelKey: 'accountNumberIban',
      numberRequired: true,
      needsBank: true,
      showsIban: false,
    })
  })

  it('leaves everything optional for Other and unknown types', () => {
    for (const type of ['Other', 'SomeNewWallet']) {
      const f = accountFieldsFor(type)
      expect(f.numberRequired).toBe(false)
      expect(f.needsBank).toBe(false)
      expect(f.showsIban).toBe(false)
    }
  })
})

describe('validateIban', () => {
  it('accepts a 24-character PK IBAN, spaced or not', () => {
    expect(validateIban('PK24SADA0000001234567890')).toBe('')
    expect(validateIban('PK24 SADA 0000 0012 3456 7890')).toBe('')
  })

  it('treats an empty value as valid', () => {
    expect(validateIban('')).toBe('')
    expect(validateIban(null)).toBe('')
  })

  it('rejects a short IBAN or a non-PK country code', () => {
    expect(validateIban('PK24SADA000000123456789')).toBe('errIbanFormat')
    expect(validateIban('XX24SADA0000001234567890')).toBe('errIbanFormat')
  })

  it('strips separators before checking', () => {
    expect(sanitizeIban('pk24-sada-0000-0012-3456-7890')).toBe('PK24SADA0000001234567890')
  })
})

describe('validateAccount', () => {
  const wallet = { type: 'JazzCash', name: 'Zaman Khan', number: '03001234567' }
  const bank = { type: BANK_TYPE, name: 'Zaman Khan', number: '12345678901234', bankName: 'Meezan Bank' }

  it('accepts a complete wallet and bank account', () => {
    expect(validateAccount(wallet)).toBe('')
    expect(validateAccount(bank)).toBe('')
  })

  it('requires a name for every type', () => {
    expect(validateAccount({ ...wallet, name: '  ' })).toBe('errNameRequired')
    expect(validateAccount({ type: 'Other', name: '' })).toBe('errNameRequired')
  })

  it('requires a bank name on a bank account only', () => {
    expect(validateAccount({ ...bank, bankName: '' })).toBe('errBankRequired')
    expect(validateAccount({ ...wallet, bankName: '' })).toBe('')
  })

  it('requires a number for wallets and banks, but not for Other', () => {
    expect(validateAccount({ ...wallet, number: '' })).toBe('errNumberRequired')
    expect(validateAccount({ ...bank, number: '' })).toBe('errNumberRequired')
    expect(validateAccount({ type: 'Other', name: 'Petty' })).toBe('')
  })

  it('reports the number-format failures by key', () => {
    expect(validateAccount({ ...wallet, number: '0300' })).toBe('errNumberWallet')
    expect(validateAccount({ ...bank, number: '03001234567' })).toBe('errNumberBank')
  })

  it('validates an IBAN only where the type offers one', () => {
    expect(validateAccount({ ...wallet, type: 'SadaPay', iban: 'XX1' })).toBe('errIbanFormat')
    expect(validateAccount({ ...wallet, type: 'SadaPay', iban: '' })).toBe('')
    expect(validateAccount({ ...wallet, type: 'SadaPay', iban: 'PK24SADA0000001234567890' })).toBe('')
    // JazzCash has no IBAN field, so a stray value can't block the save
    expect(validateAccount({ ...wallet, iban: 'XX1' })).toBe('')
  })
})
