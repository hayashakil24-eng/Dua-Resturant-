import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authenticate, requirePermission, requireRole } from '../auth/guard.js'
import * as recipes from '../services/recipes.service.js'

export async function recipeRoutes(app: FastifyInstance): Promise<void> {
  const ctx = (req: FastifyRequest) => ({ actor: req.actor })

  // Recipes — Kitchen authors, Admin approves (separation of duties).
  app.get('/api/recipes', { preHandler: authenticate }, async () => ({ recipes: await recipes.listRecipes() }))

  app.post('/api/recipes', { preHandler: requirePermission('recipeCreate') }, async (req) => {
    return { recipe: await recipes.createRecipe(ctx(req), req.body as recipes.CreateRecipeInput) }
  })

  app.post('/api/recipes/:id/approve', { preHandler: requirePermission('recipeApproval') }, async (req) => {
    const { id } = req.params as { id: string }
    return { recipe: await recipes.approveRecipe(ctx(req), id) }
  })

  app.post('/api/recipes/:id/reject', { preHandler: requirePermission('recipeApproval') }, async (req) => {
    const { id } = req.params as { id: string }
    const { reason } = (req.body ?? {}) as { reason?: string }
    return { recipe: await recipes.rejectRecipe(ctx(req), id, reason ?? '') }
  })

  // Ingredient requests — Kitchen requests, ONLY Admin approves/rejects.
  app.get('/api/ingredient-requests', { preHandler: authenticate }, async () => ({
    requests: await recipes.listIngredientRequests(),
  }))

  app.post('/api/ingredient-requests', { preHandler: requirePermission('recipeCreate') }, async (req) => {
    const { name, category } = (req.body ?? {}) as { name?: string; category?: string }
    return { request: await recipes.createIngredientRequest(ctx(req), { name, category }) }
  })

  app.post('/api/ingredient-requests/:id/approve', { preHandler: requireRole('Admin') }, async (req) => {
    const { id } = req.params as { id: string }
    const { baseUnit, initialStock, threshold } = (req.body ?? {}) as { baseUnit?: string; initialStock?: number; threshold?: number }
    return await recipes.approveIngredientRequest(ctx(req), id, { baseUnit, initialStock, threshold })
  })

  app.post('/api/ingredient-requests/:id/reject', { preHandler: requireRole('Admin') }, async (req) => {
    const { id } = req.params as { id: string }
    const { reason } = (req.body ?? {}) as { reason?: string }
    return { request: await recipes.rejectIngredientRequest(ctx(req), id, reason ?? '') }
  })
}
