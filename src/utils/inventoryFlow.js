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
