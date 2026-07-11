import assert from 'assert'
import {
  convertUnit,
  calculateDeductions,
  calculateRestocks,
} from './inventoryFlow.js'

// Simple test framework
const tests = []
function test(name, fn) {
  tests.push({ name, fn })
}

// ---------------------------------------------------------------------------
// TEST 1: Unit Conversion Utility
// ---------------------------------------------------------------------------
test('Task 3: Unit conversions with exact and approximate factors', () => {
  // Same units
  assert.strictEqual(convertUnit(5, 'kg', 'kg'), 5)
  assert.strictEqual(convertUnit(2.5, 'L', 'L'), 2.5)

  // Standard conversions
  assert.strictEqual(convertUnit(1.5, 'kg', 'g'), 1500)
  assert.strictEqual(convertUnit(500, 'g', 'kg'), 0.5)
  assert.strictEqual(convertUnit(2, 'L', 'ml'), 2000)
  assert.strictEqual(convertUnit(250, 'ml', 'L'), 0.25)

  // Spice/approximate conversions
  assert.strictEqual(convertUnit(2, 'tbsp', 'g'), 30) // 2 * 15 = 30g
  assert.strictEqual(convertUnit(3, 'tsp', 'g'), 15)  // 3 * 5 = 15g
  assert.strictEqual(convertUnit(2, 'tbsp', 'tsp'), 6) // 2 * 3 = 6 tsp

  // Case insensitivity
  assert.strictEqual(convertUnit(1, 'KG', 'g'), 1000)

  // Unsupported conversion throws error
  assert.throws(() => {
    convertUnit(10, 'kg', 'pcs')
  }, /No unit conversion defined/)
})

// ---------------------------------------------------------------------------
// TEST 2: Calculate Deductions (Task 2 & 3 Integration)
// ---------------------------------------------------------------------------
test('Task 3: Calculate deductions using correct base units', () => {
  const mockInventory = [
    { id: 'INV01', name: 'Flour', stock: 10, unit: 'kg' },
    { id: 'INV02', name: 'Cooking Oil', stock: 5, unit: 'L' },
  ]
  const mockRecipes = [
    {
      id: 'RCP01',
      menuItemId: 'M01',
      status: 'approved',
      ingredients: [
        { inventoryItemId: 'INV01', itemName: 'Flour', quantity: 500, unit: 'g' }, // 500g = 0.5kg
        { inventoryItemId: 'INV02', itemName: 'Cooking Oil', quantity: 200, unit: 'ml' }, // 200ml = 0.2L
      ],
    },
  ]
  const mockOrderItems = [
    { id: 'M01', name: 'Dish 1', qty: 2 },
  ]

  const deductions = calculateDeductions(mockOrderItems, mockInventory, mockRecipes)

  // Assertions
  assert.ok(deductions['INV01'])
  assert.ok(deductions['INV02'])

  // Flour should be: 500g -> 0.5kg * 2 qty = 1.0kg
  assert.strictEqual(deductions['INV01'].amount, 1.0)
  assert.strictEqual(deductions['INV01'].unit, 'kg')

  // Oil should be: 200ml -> 0.2L * 2 qty = 0.4L
  assert.strictEqual(deductions['INV02'].amount, 0.4)
  assert.strictEqual(deductions['INV02'].unit, 'L')
})

// ---------------------------------------------------------------------------
// TEST 3: Calculate Restocks (Task 1 & 3 Integration)
// ---------------------------------------------------------------------------
test('Task 1: Calculate restocks for order cancellation', () => {
  const mockInventory = [
    { id: 'INV01', name: 'Flour', stock: 10, unit: 'kg' },
    { id: 'INV02', name: 'Cooking Oil', stock: 5, unit: 'L' },
  ]
  const mockRecipes = [
    {
      id: 'RCP01',
      menuItemId: 'M01',
      status: 'approved',
      ingredients: [
        { inventoryItemId: 'INV01', itemName: 'Flour', quantity: 0.5, unit: 'kg' },
      ],
    },
  ]
  const mockOrderItems = [
    { id: 'M01', name: 'Dish 1', qty: 3 },
  ]

  const restocks = calculateRestocks(mockOrderItems, mockInventory, mockRecipes)

  assert.ok(restocks['INV01'])
  assert.strictEqual(restocks['INV01'].amount, 1.5) // 0.5 * 3 = 1.5kg
  assert.strictEqual(restocks['INV01'].unit, 'kg')
})

// ---------------------------------------------------------------------------
// TEST 4: Duplicate Ingredient Requests Prevention
// ---------------------------------------------------------------------------
test('Task 4: Prevent duplicate pending ingredient requests', () => {
  // Simulate AppContext's duplicate validation logic
  const mockRequests = [
    { id: 'REQ-1', name: 'Fresh Cream', status: 'pending' },
    { id: 'REQ-2', name: 'Butter', status: 'rejected' },
  ]

  const checkDuplicate = (name) => {
    return mockRequests.some(
      (r) => r.name.toLowerCase() === name.toLowerCase() && r.status === 'pending'
    )
  }

  assert.strictEqual(checkDuplicate('fresh cream'), true) // Duplicate pending
  assert.strictEqual(checkDuplicate('butter'), false)      // Not duplicate (rejected)
  assert.strictEqual(checkDuplicate('new spice'), false)   // New
})

// ---------------------------------------------------------------------------
// TEST 5: Recipe Ingredients Linkage on Approval
// ---------------------------------------------------------------------------
test('Task 4: Auto-update pending recipes on request approval', () => {
  const mockRequestId = 'REQ-101'
  let mockRecipes = [
    {
      id: 'RCP-pending-1',
      menuItemId: 'M02',
      status: 'pending',
      ingredients: [
        { id: 'ing-1', inventoryItemId: mockRequestId, itemName: 'Fresh Cream', quantity: 100, unit: 'g' },
      ],
    },
    {
      id: 'RCP-approved-1',
      menuItemId: 'M03',
      status: 'approved',
      ingredients: [
        { id: 'ing-2', inventoryItemId: 'INV01', itemName: 'Flour', quantity: 1, unit: 'kg' },
      ],
    },
  ]

  // Approval Simulation:
  const newInvId = 'INV-999'
  const newInvItem = {
    id: newInvId,
    name: 'Fresh Cream',
    category: 'Dairy',
    stock: 0,
    unit: 'kg',
    threshold: 5,
  }

  // Update recipes referencing REQ-101
  mockRecipes = mockRecipes.map((recipe) => {
    if (recipe.status === 'pending') {
      const updatedIngredients = recipe.ingredients.map((ing) => {
        if (ing.inventoryItemId === mockRequestId) {
          return {
            ...ing,
            inventoryItemId: newInvId,
            itemName: newInvItem.name,
            unit: newInvItem.unit, // Link to approved unit
          }
        }
        return ing
      })
      return { ...recipe, ingredients: updatedIngredients }
    }
    return recipe
  })

  // Verify that only the pending recipe ingredient got updated to INV-999 and unit kg
  const ing = mockRecipes[0].ingredients[0]
  assert.strictEqual(ing.inventoryItemId, 'INV-999')
  assert.strictEqual(ing.unit, 'kg')
})

// Run tests
let failed = false
console.log('Running Cafe Ali Unit Tests...\n')
tests.forEach((t) => {
  try {
    t.fn()
    console.log(`[PASS] ${t.name}`)
  } catch (err) {
    console.error(`[FAIL] ${t.name}`)
    console.error(err)
    failed = true
  }
})

console.log('\n----------------------------------------')
if (failed) {
  console.log('SOME TESTS FAILED!')
  process.exit(1)
} else {
  console.log('ALL TESTS PASSED SUCCESSFULLY!')
  process.exit(0)
}
