// Ported from frontend/src/utils/inventoryFlow.js. Logic is unchanged from
// the frontend original — the only adaptation is the order-item shape: the
// frontend's cart key is a string like "menuId::variantLabel" and these
// functions strip the "::variant" suffix before matching a recipe; the
// backend's OrderItem model normalizes that into a real `menuItemId` column
// (see schema.prisma), so there's no suffix to strip here.

export const CONVERSIONS: Record<string, number> = {
  g_kg: 0.001,
  kg_g: 1000,
  ml_l: 0.001,
  l_ml: 1000,
  tbsp_g: 15,
  g_tbsp: 1 / 15,
  tsp_g: 5,
  g_tsp: 1 / 5,
  tbsp_tsp: 3,
  tsp_tbsp: 1 / 3,
  // Direct pairs to weight/volume in kg & L too, so a recipe measured in spoons
  // or cups can still deduct from (and be costed against) an inventory item
  // stored in kg/L (convertUnit does a single direct lookup, no chaining).
  tbsp_kg: 0.015,
  kg_tbsp: 1 / 0.015,
  tsp_kg: 0.005,
  kg_tsp: 1 / 0.005,
  // Spoons → liquid volume, so a recipe measured in spoons (oil, essence, …)
  // can deduct from an inventory item stored in ml/L. 1 tbsp = 15 ml, 1 tsp = 5 ml.
  tbsp_ml: 15,
  ml_tbsp: 1 / 15,
  tbsp_l: 0.015,
  l_tbsp: 1 / 0.015,
  tsp_ml: 5,
  ml_tsp: 1 / 5,
  tsp_l: 0.005,
  l_tsp: 1 / 0.005,
  cup_ml: 240,
  ml_cup: 1 / 240,
  cup_l: 0.24,
  l_cup: 1 / 0.24,
  cup_g: 240, // approx (≈ water density) — good enough for costing/estimates
  g_cup: 1 / 240,
  cup_kg: 0.24,
  kg_cup: 1 / 0.24,
}

export function convertUnit(quantity: number, fromUnit: string, toUnit: string): number {
  const from = String(fromUnit || '').trim().toLowerCase()
  const to = String(toUnit || '').trim().toLowerCase()
  if (from === to) return quantity

  const key = `${from}_${to}`
  if (CONVERSIONS[key] !== undefined) {
    return quantity * CONVERSIONS[key]
  }

  throw new Error(`No unit conversion defined from '${fromUnit}' to '${toUnit}'.`)
}

export interface InventoryItemLike {
  id: string
  unit: string
  stock: number
  threshold: number
  costPerUnit: number | null
}

export interface RecipeIngredientLike {
  inventoryItemId: string
  itemName: string
  quantity: number
  unit: string
}

export interface RecipeLike {
  menuItemId: string
  status: string // 'pending' | 'approved' | 'rejected'
  ingredients: RecipeIngredientLike[]
}

export interface OrderItemLike {
  menuItemId: string
  qty: number
}

export interface DeductionEntry {
  amount: number
  itemName: string
  unit: string
}

// Cost (₨) of a single recipe ingredient line: convert its quantity into the
// inventory item's own unit, then multiply by that item's costPerUnit. Returns 0
// when the item, its cost, or a unit conversion is unknown — costing degrades
// gracefully instead of throwing (an un-costed ingredient just adds nothing).
export function ingredientCost(ing: RecipeIngredientLike, inventory: InventoryItemLike[] = []): number {
  const inv = inventory.find((x) => x.id === ing.inventoryItemId)
  if (!inv || inv.costPerUnit == null) return 0
  let qtyInInvUnit: number
  try {
    qtyInInvUnit = convertUnit(Number(ing.quantity) || 0, ing.unit, inv.unit)
  } catch {
    return 0
  }
  const cost = qtyInInvUnit * (Number(inv.costPerUnit) || 0)
  return cost > 0 ? cost : 0
}

// Total ₨ cost to make one serving of a recipe = sum of its ingredient lines.
export function calculateRecipeCost(ingredients: RecipeIngredientLike[] = [], inventory: InventoryItemLike[] = []): number {
  return ingredients.reduce((sum, ing) => sum + ingredientCost(ing, inventory), 0)
}

function getActiveRecipe(menuItemId: string, recipes: RecipeLike[]): RecipeLike | undefined {
  return recipes.find((r) => r.menuItemId === menuItemId && r.status === 'approved')
}

export function calculateDeductions(
  orderItems: OrderItemLike[] = [],
  inventory: InventoryItemLike[] = [],
  recipes: RecipeLike[] = [],
): Record<string, DeductionEntry> {
  const deductions: Record<string, DeductionEntry> = {}

  orderItems.forEach((oi) => {
    const recipe = getActiveRecipe(oi.menuItemId, recipes)
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

// Total ₨ material cost consumed by a set of order line items: the same
// approved-recipe deductions that leave inventory, valued at each item's
// costPerUnit. This is what a cancelled (already-cooked) order writes off as a
// loss. Items without an approved recipe or a known cost contribute nothing.
export function calculateOrderMaterialCost(
  orderItems: OrderItemLike[] = [],
  inventory: InventoryItemLike[] = [],
  recipes: RecipeLike[] = [],
): number {
  let deductions: Record<string, DeductionEntry>
  try {
    deductions = calculateDeductions(orderItems, inventory, recipes)
  } catch {
    return 0
  }
  return Object.entries(deductions).reduce((sum, [invId, d]) => {
    const inv = inventory.find((x) => x.id === invId)
    if (!inv || inv.costPerUnit == null) return sum
    // d.amount is already expressed in the inventory item's own unit.
    return sum + d.amount * (Number(inv.costPerUnit) || 0)
  }, 0)
}

export type StockStatus = 'none' | 'out' | 'low' | 'normal'

export interface RecipeStock {
  status: StockStatus
  maxServings: number
}

// Stock status for a single menu item, derived from its APPROVED recipe and
// current inventory. Items without a recipe (or whose ingredients aren't
// tracked) are unconstrained → { status: 'none', maxServings: Infinity }.
//   out    — can't make even one (an ingredient is short)
//   low    — can make ≥1, but making one takes an ingredient to/below threshold
//   normal — comfortably in stock
export function getRecipeStock(menuItemId: string, inventory: InventoryItemLike[] = [], recipes: RecipeLike[] = []): RecipeStock {
  const recipe = recipes.find((r) => r.menuItemId === menuItemId && r.status === 'approved')
  if (!recipe || !recipe.ingredients?.length) return { status: 'none', maxServings: Infinity }

  let maxServings = Infinity
  let low = false
  for (const ing of recipe.ingredients) {
    const inv = inventory.find((x) => x.id === ing.inventoryItemId)
    if (!inv) continue // ingredient not tracked in inventory → don't constrain
    let need: number
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

export interface StockShortfall {
  itemName: string
  need: number
  have: number
  unit: string
}

// Returns the first ingredient a cart can't fully cover, or null if the whole
// cart is fulfillable. Used to block checkout on out-of-stock. Safe against
// unit-conversion errors (treats them as "can't determine" → no block).
export function getStockShortfall(
  orderItems: OrderItemLike[] = [],
  inventory: InventoryItemLike[] = [],
  recipes: RecipeLike[] = [],
): StockShortfall | null {
  let deductions: Record<string, DeductionEntry>
  try {
    deductions = calculateDeductions(orderItems, inventory, recipes)
  } catch {
    return null
  }
  for (const [invId, d] of Object.entries(deductions)) {
    const inv = inventory.find((x) => x.id === invId)
    if (inv && d.amount > (Number(inv.stock) || 0) + 1e-6) {
      return { itemName: d.itemName || inv.id, need: d.amount, have: Number(inv.stock) || 0, unit: d.unit }
    }
  }
  return null
}

export function calculateRestocks(
  orderItems: OrderItemLike[] = [],
  inventory: InventoryItemLike[] = [],
  recipes: RecipeLike[] = [],
): Record<string, DeductionEntry> {
  const restocks: Record<string, DeductionEntry> = {}

  orderItems.forEach((oi) => {
    const recipe = getActiveRecipe(oi.menuItemId, recipes)
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
