// Recipes + ingredient requests — port of AppContext.jsx's createRecipe /
// approveRecipe / rejectRecipe and createIngredientRequest /
// approveIngredientRequest / rejectIngredientRequest.
//
// Separation of duties (unchanged from permissions.js): Kitchen authors
// recipes (pending), only Admin approves them. Only Admin approves/rejects
// ingredient requests.
//
// One schema-driven divergence from the frontend: there, a Kitchen user could
// author a recipe whose ingredient pointed at a not-yet-created REQ- id, and
// approveIngredientRequest later patched those refs to the new INV- id. Here
// RecipeIngredient.inventoryItemId is a real FK (schema.prisma, onDelete
// Restrict), so a recipe can only reference an inventory item that already
// exists — the request must be approved (which creates the item) before a
// recipe can use it. So approveIngredientRequest just creates the InventoryItem;
// there are no dangling recipe refs to patch.

import type { Prisma } from '@prisma/client'
import { prisma } from '../db/client.js'
import { ingredientCost, calculateRecipeCost, type InventoryItemLike, type RecipeIngredientLike } from '../core/inventoryFlow.js'
import { writeAudit } from '../lib/audit.js'
import { ServiceError } from '../lib/errors.js'
import type { Actor } from '../lib/actor.js'

type Tx = Prisma.TransactionClient
interface Ctx {
  actor: Actor
}

async function loadInventoryLike(tx: Tx): Promise<(InventoryItemLike & { name: string })[]> {
  const rows = await tx.inventoryItem.findMany()
  return rows.map((i) => ({ id: i.id, name: i.name, unit: i.unit, stock: i.stock, threshold: i.threshold, costPerUnit: i.costPerUnit }))
}

// ---- Recipes --------------------------------------------------------------

export async function listRecipes() {
  return prisma.recipe.findMany({ include: { ingredients: true }, orderBy: { createdAt: 'desc' } })
}

export interface CreateRecipeInput {
  menuItemId: string
  menuItemName: string
  ingredients: { inventoryItemId: string; itemName?: string; quantity: number; unit: string }[]
}

export async function createRecipe(ctx: Ctx, input: CreateRecipeInput) {
  if (!input?.menuItemId || !input?.ingredients?.length) {
    throw new ServiceError('A recipe needs a menu item and at least one ingredient.')
  }
  return prisma.$transaction(async (tx) => {
    const inventory = await loadInventoryLike(tx)
    const ings: RecipeIngredientLike[] = input.ingredients.map((ing) => ({
      inventoryItemId: ing.inventoryItemId,
      itemName: ing.itemName ?? inventory.find((x) => x.id === ing.inventoryItemId)?.name ?? '',
      quantity: Number(ing.quantity) || 0,
      unit: ing.unit,
    }))
    // Every ingredient must reference a real inventory item (FK + gives us the
    // cost/unit snapshot).
    for (const ing of ings) {
      if (!inventory.some((x) => x.id === ing.inventoryItemId)) {
        throw new ServiceError(`Unknown inventory item: ${ing.inventoryItemId}`)
      }
    }

    const recipe = await tx.recipe.create({
      data: {
        menuItemId: input.menuItemId,
        menuItemName: input.menuItemName,
        totalCost: Math.round(calculateRecipeCost(ings, inventory)),
        status: 'pending',
        createdBy: ctx.actor.name,
        createdByRole: ctx.actor.role,
        ingredients: {
          create: ings.map((ing) => ({
            inventoryItemId: ing.inventoryItemId,
            itemName: ing.itemName,
            quantity: ing.quantity,
            unit: ing.unit,
            costPerUnit: Math.round(inventory.find((x) => x.id === ing.inventoryItemId)?.costPerUnit ?? 0),
            lineCost: Math.round(ingredientCost(ing, inventory)),
          })),
        },
      },
      include: { ingredients: true },
    })
    await writeAudit(tx, {
      action: 'RECIPE_SUBMITTED',
      actor: ctx.actor,
      details: { recipeId: recipe.id, recipeName: input.menuItemName },
    })
    return recipe
  })
}

// Kitchen edits an existing recipe's ingredients. Any edit sends the recipe
// back to 'pending' and clears prior approve/reject stamps, so a change to a
// live recipe can't silently alter inventory deductions without a fresh Admin
// approval (same separation-of-duties gate as creating one).
export async function updateRecipe(
  ctx: Ctx,
  recipeId: string,
  input: { ingredients: CreateRecipeInput['ingredients'] },
) {
  if (!input?.ingredients?.length) {
    throw new ServiceError('A recipe needs at least one ingredient.')
  }
  return prisma.$transaction(async (tx) => {
    const existing = await tx.recipe.findUnique({ where: { id: recipeId } })
    if (!existing) throw new ServiceError('Recipe not found.', 404)
    const inventory = await loadInventoryLike(tx)
    const ings: RecipeIngredientLike[] = input.ingredients.map((ing) => ({
      inventoryItemId: ing.inventoryItemId,
      itemName: ing.itemName ?? inventory.find((x) => x.id === ing.inventoryItemId)?.name ?? '',
      quantity: Number(ing.quantity) || 0,
      unit: ing.unit,
    }))
    for (const ing of ings) {
      if (!inventory.some((x) => x.id === ing.inventoryItemId)) {
        throw new ServiceError(`Unknown inventory item: ${ing.inventoryItemId}`)
      }
    }
    // Replace ingredient rows wholesale (simpler + audit-clearer than diffing).
    await tx.recipeIngredient.deleteMany({ where: { recipeId } })
    const updated = await tx.recipe.update({
      where: { id: recipeId },
      data: {
        totalCost: Math.round(calculateRecipeCost(ings, inventory)),
        status: 'pending',
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectReason: null,
        ingredients: {
          create: ings.map((ing) => ({
            inventoryItemId: ing.inventoryItemId,
            itemName: ing.itemName,
            quantity: ing.quantity,
            unit: ing.unit,
            costPerUnit: Math.round(inventory.find((x) => x.id === ing.inventoryItemId)?.costPerUnit ?? 0),
            lineCost: Math.round(ingredientCost(ing, inventory)),
          })),
        },
      },
      include: { ingredients: true },
    })
    await writeAudit(tx, {
      action: 'RECIPE_UPDATED',
      actor: ctx.actor,
      details: { recipeId, recipeName: existing.menuItemName },
    })
    return updated
  })
}

// Admin-only hard delete. Destructive, so it's gated tighter than authoring and
// records a reason in the audit log. RecipeIngredient's FK is onDelete: Cascade,
// so the ingredient rows go with the recipe.
export async function deleteRecipe(ctx: Ctx, recipeId: string, reason = '') {
  return prisma.$transaction(async (tx) => {
    const r = await tx.recipe.findUnique({ where: { id: recipeId } })
    if (!r) throw new ServiceError('Recipe not found.', 404)
    await tx.recipe.delete({ where: { id: recipeId } })
    await writeAudit(tx, {
      action: 'RECIPE_DELETED',
      actor: ctx.actor,
      details: { recipeId, recipeName: r.menuItemName, reason },
    })
    return { success: true }
  })
}

export async function approveRecipe(ctx: Ctx, recipeId: string) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.recipe.findUnique({ where: { id: recipeId } })
    if (!r) throw new ServiceError('Recipe not found.', 404)
    const at = new Date()
    const updated = await tx.recipe.update({
      where: { id: recipeId },
      data: { status: 'approved', approvedBy: ctx.actor.name, approvedAt: at },
      include: { ingredients: true },
    })
    await writeAudit(tx, { action: 'RECIPE_APPROVED', actor: ctx.actor, at, details: { recipeId } })
    return updated
  })
}

export async function rejectRecipe(ctx: Ctx, recipeId: string, reason = '') {
  return prisma.$transaction(async (tx) => {
    const r = await tx.recipe.findUnique({ where: { id: recipeId } })
    if (!r) throw new ServiceError('Recipe not found.', 404)
    const at = new Date()
    const updated = await tx.recipe.update({
      where: { id: recipeId },
      data: { status: 'rejected', rejectedBy: ctx.actor.name, rejectedAt: at, rejectReason: reason },
      include: { ingredients: true },
    })
    await writeAudit(tx, { action: 'RECIPE_REJECTED', actor: ctx.actor, at, details: { recipeId, reason } })
    return updated
  })
}

// ---- Ingredient requests --------------------------------------------------

export async function listIngredientRequests() {
  return prisma.ingredientRequest.findMany({ orderBy: { requestedAt: 'desc' } })
}

export async function createIngredientRequest(ctx: Ctx, input: { name?: string; category?: string }) {
  const name = (input.name ?? '').trim()
  if (!name) throw new ServiceError('Ingredient name is required.')
  return prisma.$transaction(async (tx) => {
    const pending = await tx.ingredientRequest.findMany({ where: { status: 'pending' } })
    if (pending.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      throw new ServiceError('A pending request for this ingredient already exists.')
    }
    const req = await tx.ingredientRequest.create({
      data: { name, category: input.category || 'Other', status: 'pending', requestedBy: ctx.actor.name },
    })
    await writeAudit(tx, { action: 'INGREDIENT_REQUESTED', actor: ctx.actor, details: { requestId: req.id, name } })
    return req
  })
}

// Next "INV##" id — shared convention with inventory.service; duplicated here to
// keep it inside the transaction that creates the item.
async function nextInvId(tx: Tx): Promise<string> {
  const rows = await tx.inventoryItem.findMany({ select: { id: true } })
  const maxNum = rows.reduce((max, r) => {
    const m = /^INV0*(\d+)$/.exec(r.id)
    return m ? Math.max(max, Number(m[1])) : max
  }, 0)
  return `INV${String(maxNum + 1).padStart(2, '0')}`
}

export async function approveIngredientRequest(
  ctx: Ctx,
  requestId: string,
  opts: { baseUnit?: string; initialStock?: number; threshold?: number } = {},
) {
  return prisma.$transaction(async (tx) => {
    const req = await tx.ingredientRequest.findUnique({ where: { id: requestId } })
    if (!req) throw new ServiceError('Request not found.', 404)
    if (req.status !== 'pending') throw new ServiceError('This request has already been resolved.')
    const at = new Date()
    const invId = await nextInvId(tx)
    const item = await tx.inventoryItem.create({
      data: {
        id: invId,
        name: req.name,
        category: req.category,
        stock: Number(opts.initialStock) || 0,
        unit: opts.baseUnit || 'kg',
        threshold: Number(opts.threshold) || 10,
        active: true,
      },
    })
    await tx.ingredientRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        approvedBy: ctx.actor.name,
        approvedAt: at,
        baseUnit: opts.baseUnit ?? null,
        initialStock: opts.initialStock ?? null,
        threshold: opts.threshold ?? null,
        inventoryItemId: invId,
      },
    })
    await writeAudit(tx, {
      action: 'INGREDIENT_REQUEST_APPROVED',
      actor: ctx.actor,
      at,
      details: { requestId, inventoryItemId: invId, name: req.name },
    })
    return { request: await tx.ingredientRequest.findUnique({ where: { id: requestId } }), inventoryItem: item }
  })
}

export async function rejectIngredientRequest(ctx: Ctx, requestId: string, reason = '') {
  return prisma.$transaction(async (tx) => {
    const req = await tx.ingredientRequest.findUnique({ where: { id: requestId } })
    if (!req) throw new ServiceError('Request not found.', 404)
    const at = new Date()
    const updated = await tx.ingredientRequest.update({
      where: { id: requestId },
      data: { status: 'rejected', rejectReason: reason, rejectedBy: ctx.actor.name, rejectedAt: at },
    })
    await writeAudit(tx, { action: 'INGREDIENT_REQUEST_REJECTED', actor: ctx.actor, at, details: { requestId, reason } })
    return updated
  })
}
