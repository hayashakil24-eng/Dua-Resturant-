// WHATSAPP_PHONE_NUMBER_ID/ACCESS_TOKEN must be set before env.ts's module-load-
// time `env.whatsapp.*` reads process.env — hence the dynamic import inside
// beforeAll rather than a static top-level import, which ESM would hoist ahead
// of the process.env assignment.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '../src/db/client.js'

process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id'
process.env.WHATSAPP_ACCESS_TOKEN = 'test-token'

let addWhatsappRecipient: typeof import('../src/services/whatsappRecipients.service.js')['addWhatsappRecipient']
let recheckWhatsappRecipient: typeof import('../src/services/whatsappRecipients.service.js')['recheckWhatsappRecipient']
let removeWhatsappRecipient: typeof import('../src/services/whatsappRecipients.service.js')['removeWhatsappRecipient']
let listWhatsappRecipients: typeof import('../src/services/whatsappRecipients.service.js')['listWhatsappRecipients']

const actor = { name: 'Test Admin', role: 'Admin' } as never

// Simulates Meta's Graph API — controlled per-test via fetchBehavior.
const fetchBehavior = vi.hoisted(() => ({ mode: 'success' as 'success' | 'notAllowed' | 'serverError' }))

beforeAll(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (fetchBehavior.mode === 'success') {
        return new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] }), { status: 200 })
      }
      if (fetchBehavior.mode === 'notAllowed') {
        return new Response(JSON.stringify({ error: { message: 'Recipient phone number not in allowed list', code: 131030 } }), {
          status: 400,
        })
      }
      return new Response(JSON.stringify({ error: { message: 'Internal Server Error', code: 1 } }), { status: 500 })
    }),
  )
  ;({ addWhatsappRecipient, recheckWhatsappRecipient, removeWhatsappRecipient, listWhatsappRecipients } = await import(
    '../src/services/whatsappRecipients.service.js'
  ))
})

afterEach(async () => {
  await prisma.whatsappRecipient.deleteMany()
  fetchBehavior.mode = 'success'
})

describe('whatsappRecipients.service', () => {
  it('adds and verifies a number Meta actually accepts', async () => {
    fetchBehavior.mode = 'success'
    const rec = await addWhatsappRecipient({ actor }, { phone: '923001234567' })
    expect(rec.verified).toBe(true)
    expect(rec.verifiedAt).not.toBeNull()
    expect((await listWhatsappRecipients()).map((r) => r.phone)).toEqual(['923001234567'])
  })

  it('adds but marks unverified when Meta says the number is not on the allow-list', async () => {
    fetchBehavior.mode = 'notAllowed'
    const rec = await addWhatsappRecipient({ actor }, { phone: '923009999999' })
    expect(rec.verified).toBe(false)
    expect(rec.lastError).toMatch(/not added/i)
  })

  it('rejects a duplicate phone number', async () => {
    await addWhatsappRecipient({ actor }, { phone: '923001111111' })
    await expect(addWhatsappRecipient({ actor }, { phone: '923001111111' })).rejects.toThrow(/already been added/i)
  })

  it('rejects a 6th recipient — Meta test-mode allows at most 5', async () => {
    for (let i = 0; i < 5; i++) {
      await addWhatsappRecipient({ actor }, { phone: `92300000000${i}` })
    }
    await expect(addWhatsappRecipient({ actor }, { phone: '923009999998' })).rejects.toThrow(/at most 5/i)
  })

  it('recheck flips a previously-unverified number to verified once Meta allows it', async () => {
    fetchBehavior.mode = 'notAllowed'
    const rec = await addWhatsappRecipient({ actor }, { phone: '923002222222' })
    expect(rec.verified).toBe(false)

    fetchBehavior.mode = 'success'
    const rechecked = await recheckWhatsappRecipient({ actor }, rec.id)
    expect(rechecked.verified).toBe(true)
  })

  it('does not silently mark unverified on an unrelated API failure', async () => {
    fetchBehavior.mode = 'serverError'
    await expect(addWhatsappRecipient({ actor }, { phone: '923003333333' })).rejects.toThrow(/WhatsApp API error/)
    expect(await listWhatsappRecipients()).toEqual([])
  })

  it('removes a recipient', async () => {
    const rec = await addWhatsappRecipient({ actor }, { phone: '923004444444' })
    await removeWhatsappRecipient({ actor }, rec.id)
    expect(await listWhatsappRecipients()).toEqual([])
  })
})
