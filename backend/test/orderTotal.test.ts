import { describe, expect, it } from 'vitest'
import { orderTotal } from '../src/core/orderTotal.js'

describe('orderTotal', () => {
  it('computes subtotal with no tax/discount', () => {
    const result = orderTotal([{ price: 100, qty: 2 }])
    expect(result).toEqual({ subtotal: 200, tax: 0, discount: 0, total: 200 })
  })

  it('applies GST at the given rate, rounded', () => {
    const result = orderTotal([{ price: 100, qty: 1 }], 0, 0.05)
    expect(result.tax).toBe(5)
    expect(result.total).toBe(105)
  })

  it('clamps a discount so the total never goes negative', () => {
    const result = orderTotal([{ price: 50, qty: 1 }], 999, 0)
    expect(result.discount).toBe(50)
    expect(result.total).toBe(0)
  })

  it('never applies a negative discount', () => {
    const result = orderTotal([{ price: 100, qty: 1 }], -20, 0)
    expect(result.discount).toBe(0)
    expect(result.total).toBe(100)
  })
})
