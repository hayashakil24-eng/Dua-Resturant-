export const CONVERSIONS = {
  'g_kg': 0.001,
  'kg_g': 1000,
  'ml_l': 0.001,
  'l_ml': 1000,
  'tbsp_g': 15,
  'g_tbsp': 1 / 15,
  'tsp_g': 5,
  'g_tsp': 1 / 5,
  'tbsp_tsp': 3,
  'tsp_tbsp': 1 / 3,
}

export function convertUnit(quantity, fromUnit, toUnit) {
  const from = String(fromUnit || '').trim().toLowerCase()
  const to = String(toUnit || '').trim().toLowerCase()
  if (from === to) return quantity

  const key = `${from}_${to}`
  if (CONVERSIONS[key] !== undefined) {
    return quantity * CONVERSIONS[key]
  }

  throw new Error(`No unit conversion defined from '${fromUnit}' to '${toUnit}'.`)
}

export function calculateDeductions(orderItems = [], inventory = [], recipes = []) {
  const deductions = {} // inventoryItemId -> { amount, itemName, unit }
  
  const getActiveRecipe = (menuItemId) =>
    recipes.find((r) => r.menuItemId === menuItemId && r.status === 'approved')

  orderItems.forEach((oi) => {
    const baseId = String(oi.id).split('::')[0]
    const recipe = getActiveRecipe(baseId)
    if (!recipe) return
    recipe.ingredients.forEach((ing) => {
      const invItem = inventory.find((x) => x.id === ing.inventoryItemId)
      if (!invItem) return

      const convertedQuantity = convertUnit(Number(ing.quantity) || 0, ing.unit, invItem.unit)
      const amount = convertedQuantity * (Number(oi.qty) || 0)
      if (amount <= 0) return
      const cur = deductions[ing.inventoryItemId] || { amount: 0, itemName: ing.itemName, unit: invItem.unit }
      cur.amount += amount
      deductions[ing.inventoryItemId] = cur
    })
  })

  return deductions
}

// Stock status for a single menu item, derived from its APPROVED recipe and
// current inventory. Items without a recipe (or whose ingredients aren't
// tracked) are unconstrained → { status: 'none', maxServings: Infinity }.
//   out    — can't make even one (an ingredient is short)
//   low    — can make ≥1, but making one takes an ingredient to/below threshold
//   normal — comfortably in stock
export function getRecipeStock(menuItemId, inventory = [], recipes = []) {
  const baseId = String(menuItemId).split('::')[0]
  const recipe = recipes.find((r) => r.menuItemId === baseId && r.status === 'approved')
  if (!recipe || !recipe.ingredients?.length) return { status: 'none', maxServings: Infinity }

  let maxServings = Infinity
  let low = false
  for (const ing of recipe.ingredients) {
    const inv = inventory.find((x) => x.id === ing.inventoryItemId)
    if (!inv) continue // ingredient not tracked in inventory → don't constrain
    let need
    try {
      need = convertUnit(Number(ing.quantity) || 0, ing.unit, inv.unit)
    } catch {
      continue // no known unit conversion → skip this constraint
    }
    if (need <= 0) continue
    const servings = Math.floor((Number(inv.stock) || 0) / need)
    if (servings < maxServings) maxServings = servings
    if ((Number(inv.stock) || 0) - need <= (Number(inv.threshold) || 0)) low = true
  }

  if (maxServings === Infinity) return { status: 'none', maxServings: Infinity }
  if (maxServings < 1) return { status: 'out', maxServings: 0 }
  return { status: low ? 'low' : 'normal', maxServings }
}

// Returns the first ingredient a cart can't fully cover, or null if the whole
// cart is fulfillable. Used to block checkout on out-of-stock. Safe against
// unit-conversion errors (treats them as "can't determine" → no block).
export function getStockShortfall(orderItems = [], inventory = [], recipes = []) {
  let deductions
  try {
    deductions = calculateDeductions(orderItems, inventory, recipes)
  } catch {
    return null
  }
  for (const [invId, d] of Object.entries(deductions)) {
    const inv = inventory.find((x) => x.id === invId)
    if (inv && d.amount > (Number(inv.stock) || 0) + 1e-6) {
      return { itemName: d.itemName || inv.name, need: d.amount, have: Number(inv.stock) || 0, unit: d.unit || inv.unit }
    }
  }
  return null
}

export function calculateRestocks(orderItems = [], inventory = [], recipes = []) {
  const restocks = {} // inventoryItemId -> { amount, itemName, unit }
  
  const getActiveRecipe = (menuItemId) =>
    recipes.find((r) => r.menuItemId === menuItemId && r.status === 'approved')

  orderItems.forEach((oi) => {
    const baseId = String(oi.id).split('::')[0]
    const recipe = getActiveRecipe(baseId)
    if (!recipe) return
    recipe.ingredients.forEach((ing) => {
      const invItem = inventory.find((x) => x.id === ing.inventoryItemId)
      if (!invItem) return

      const convertedQuantity = convertUnit(Number(ing.quantity) || 0, ing.unit, invItem.unit)
      const amount = convertedQuantity * (Number(oi.qty) || 0)
      if (amount <= 0) return
      const cur = restocks[ing.inventoryItemId] || { amount: 0, itemName: ing.itemName, unit: invItem.unit }
      cur.amount += amount
      restocks[ing.inventoryItemId] = cur
    })
  })

  return restocks
}
