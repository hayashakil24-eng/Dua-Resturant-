import { describe, expect, it } from 'vitest'
import {
  calculateDeductions,
  calculateOrderMaterialCost,
  calculateRecipeCost,
  calculateRestocks,
  convertUnit,
  getRecipeStock,
  getStockShortfall,
  ingredientCost,
  type InventoryItemLike,
  type RecipeLike,
} from '../src/core/inventoryFlow.js'

// Same ckh1 (Chicken Shahi Karahi) recipe as mockData.js INITIAL_RECIPES /
// prisma/seed.ts — kept identical on purpose so this test is checking the
// exact fixture that was verified live against the running frontend before
// this backend existed (see the "Known-good fixture" note in seed.ts).
const inventory: InventoryItemLike[] = [
  { id: 'INV02', unit: 'L', stock: 1, threshold: 8, costPerUnit: 550 }, // Cooking Oil
  { id: 'INV03', unit: 'kg', stock: 3, threshold: 12, costPerUnit: 550 }, // Chicken
]

const recipes: RecipeLike[] = [
  {
    menuItemId: 'ckh1',
    status: 'approved',
    ingredients: [
      { inventoryItemId: 'INV03', itemName: 'Chicken', quantity: 0.5, unit: 'kg' },
      { inventoryItemId: 'INV02', itemName: 'Cooking Oil', quantity: 0.1, unit: 'L' },
    ],
  },
]

describe('convertUnit', () => {
  it('returns the same quantity when units already match', () => {
    expect(convertUnit(5, 'kg', 'kg')).toBe(5)
  })

  it('converts between known unit pairs', () => {
    expect(convertUnit(1, 'kg', 'g')).toBe(1000)
    expect(convertUnit(500, 'g', 'kg')).toBe(0.5)
  })

  it('throws for an unknown conversion pair', () => {
    expect(() => convertUnit(1, 'kg', 'pcs')).toThrow()
  })
})

describe('calculateDeductions — ckh1 known-good fixture', () => {
  it('deducts 1 kg Chicken + 0.2 L Cooking Oil for 2x Chicken Shahi Karahi', () => {
    const deductions = calculateDeductions([{ menuItemId: 'ckh1', qty: 2 }], inventory, recipes)

    expect(deductions.INV03).toBeDefined()
    expect(deductions.INV03!.amount).toBeCloseTo(1, 6)
    expect(deductions.INV03!.itemName).toBe('Chicken')
    expect(deductions.INV03!.unit).toBe('kg')

    expect(deductions.INV02).toBeDefined()
    expect(deductions.INV02!.amount).toBeCloseTo(0.2, 6)
    expect(deductions.INV02!.unit).toBe('L')
  })

  it('produces no deductions for a menu item with no approved recipe', () => {
    const deductions = calculateDeductions([{ menuItemId: 'unrecipe-1', qty: 5 }], inventory, recipes)
    expect(Object.keys(deductions)).toHaveLength(0)
  })
})

describe('getStockShortfall', () => {
  it('flags Chicken as short when the order needs more than is in stock', () => {
    // Stock has 3 kg Chicken; ordering 10x karahi needs 5 kg.
    const shortfall = getStockShortfall([{ menuItemId: 'ckh1', qty: 10 }], inventory, recipes)
    expect(shortfall).not.toBeNull()
    expect(shortfall?.itemName).toBe('Chicken')
  })

  it('returns null when the whole cart is fulfillable', () => {
    const shortfall = getStockShortfall([{ menuItemId: 'ckh1', qty: 1 }], inventory, recipes)
    expect(shortfall).toBeNull()
  })
})

describe('getRecipeStock', () => {
  it('reports "none" for an item with no approved recipe', () => {
    expect(getRecipeStock('no-recipe-item', inventory, recipes)).toEqual({ status: 'none', maxServings: Infinity })
  })

  it('reports maxServings bounded by the scarcest ingredient (Chicken: 3kg / 0.5kg = 6)', () => {
    const result = getRecipeStock('ckh1', inventory, recipes)
    expect(result.status).not.toBe('none')
    expect(result.maxServings).toBe(6)
  })
})

describe('calculateRestocks', () => {
  it('mirrors calculateDeductions in reverse (used when a reusable cancelled item is restocked)', () => {
    const restocks = calculateRestocks([{ menuItemId: 'ckh1', qty: 1 }], inventory, recipes)
    expect(restocks.INV03!.amount).toBeCloseTo(0.5, 6)
    expect(restocks.INV02!.amount).toBeCloseTo(0.1, 6)
  })
})

describe('ingredientCost / calculateRecipeCost', () => {
  it('costs the Chicken line at 0.5kg * Rs.550/kg = Rs.275', () => {
    const cost = ingredientCost({ inventoryItemId: 'INV03', itemName: 'Chicken', quantity: 0.5, unit: 'kg' }, inventory)
    expect(cost).toBeCloseTo(275, 6)
  })

  it('sums the full recipe to Rs.330 (275 Chicken + 55 Cooking Oil)', () => {
    const total = calculateRecipeCost(recipes[0]!.ingredients, inventory)
    expect(total).toBeCloseTo(330, 6)
  })
})

describe('calculateOrderMaterialCost', () => {
  it('values 2x Chicken Shahi Karahi at Rs.660 (2 * Rs.330 recipe cost)', () => {
    const cost = calculateOrderMaterialCost([{ menuItemId: 'ckh1', qty: 2 }], inventory, recipes)
    expect(cost).toBeCloseTo(660, 6)
  })
})
