import { describe, expect, it } from 'vitest'
import { complimentaryCost, lineCost, lineCostEstimated, type MenuItemLike, type OrderItemLike } from '../src/core/cost.js'

const menu: MenuItemLike[] = [
  { id: 'ckh1', cost: 1100, costEstimated: true },
  { id: 'pz1', cost: 400, costEstimated: false, variants: [{ label: 'Large', price: 1200, cost: 500, costEstimated: false }] },
  { id: 'unknown-cost-item', cost: null, costEstimated: true },
]

describe('lineCost', () => {
  it('prefers the line\'s own cost snapshot over the menu lookup', () => {
    const item: OrderItemLike = { menuItemId: 'ckh1', qty: 1, price: 2699, cost: 999 }
    expect(lineCost(item, menu)).toBe(999)
  })

  it('falls back to the base menu item cost when no snapshot exists', () => {
    const item: OrderItemLike = { menuItemId: 'ckh1', qty: 1, price: 2699 }
    expect(lineCost(item, menu)).toBe(1100)
  })

  it('resolves a variant cost via variantLabel instead of the base cost', () => {
    const item: OrderItemLike = { menuItemId: 'pz1', variantLabel: 'Large', qty: 1, price: 1200 }
    expect(lineCost(item, menu)).toBe(500)
  })

  it('returns null (never 0) when the cost is genuinely unknown', () => {
    const item: OrderItemLike = { menuItemId: 'unknown-cost-item', qty: 1, price: 100 }
    expect(lineCost(item, menu)).toBeNull()
  })

  it('returns null for a menu item that no longer exists', () => {
    const item: OrderItemLike = { menuItemId: 'deleted-item', qty: 1, price: 100 }
    expect(lineCost(item, menu)).toBeNull()
  })
})

describe('lineCostEstimated', () => {
  it('reads the line snapshot first, then falls back to the menu item flag', () => {
    expect(lineCostEstimated({ menuItemId: 'ckh1', qty: 1, price: 1, costEstimated: false }, menu)).toBe(false)
    expect(lineCostEstimated({ menuItemId: 'ckh1', qty: 1, price: 1 }, menu)).toBe(true)
    expect(lineCostEstimated({ menuItemId: 'pz1', qty: 1, price: 1 }, menu)).toBe(false)
  })
})

describe('complimentaryCost', () => {
  it('reports allKnown + a real lostMargin when every line has a known cost', () => {
    const order = {
      items: [{ menuItemId: 'ckh1', qty: 2, price: 2699, cost: 1100 }],
      discountAmount: 0,
      gstRate: 0,
    }
    const result = complimentaryCost(order, menu)
    expect(result.billTotal).toBe(5398)
    expect(result.costTotal).toBe(2200)
    expect(result.allKnown).toBe(true)
    expect(result.lostMargin).toBe(5398 - 2200)
  })

  it('reports allKnown=false and lostMargin=null when any line has an unknown cost', () => {
    const order = {
      items: [
        { menuItemId: 'ckh1', qty: 1, price: 2699, cost: 1100 },
        { menuItemId: 'unknown-cost-item', qty: 1, price: 500 },
      ],
      discountAmount: 0,
      gstRate: 0,
    }
    const result = complimentaryCost(order, menu)
    expect(result.allKnown).toBe(false)
    expect(result.lostMargin).toBeNull()
    // billTotal still reflects the full bill even though cost is partly unknown.
    expect(result.billTotal).toBe(3199)
  })
})
