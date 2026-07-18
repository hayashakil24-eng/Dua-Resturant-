import { describe, expect, it } from 'vitest'
import { prisma } from '../src/db/client.js'
import { nextSequence } from '../src/core/ids.js'

// Hits the real (local SQLite dev) database — this is intentional: the thing
// being proven is that concurrent/repeated calls against the actual DB never
// hand out a duplicate number, which a pure-function unit test can't show.
// Doesn't assert an absolute starting value, since prisma/seed.ts may have
// already advanced these counters.

describe('nextSequence', () => {
  it('returns strictly increasing, unique values on repeated calls', async () => {
    const values: number[] = []
    for (let i = 0; i < 5; i++) {
      const v = await prisma.$transaction((tx) => nextSequence(tx, 'order'))
      values.push(v)
    }
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBe(values[i - 1]! + 1)
    }
    expect(new Set(values).size).toBe(values.length)
  })

  it('keeps independent counters per sequence name', async () => {
    const before = await prisma.$transaction((tx) => nextSequence(tx, 'transaction'))
    const orderVal = await prisma.$transaction((tx) => nextSequence(tx, 'order'))
    const after = await prisma.$transaction((tx) => nextSequence(tx, 'transaction'))
    expect(after).toBe(before + 1) // unaffected by the interleaved 'order' call
    expect(orderVal).toBeGreaterThan(0)
  })
})
