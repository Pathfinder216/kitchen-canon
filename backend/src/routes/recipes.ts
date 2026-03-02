import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { createRecipeSchema, updateRecipeSchema, recipeQuerySchema } from '../schemas/recipe.schema.js';
import * as recipeService from '../services/recipe.service.js';
import { recipeToJson, recipeToText } from '../services/export.service.js';
import { getSubstitutionsForRecipe } from '../services/substitutions.service.js';

const router = Router();

// Async handler wrapper
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// GET /api/recipes - List recipes
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = recipeQuerySchema.parse(req.query);
    const result = await recipeService.listRecipes(query);
    res.json(result);
  }),
);

// GET /api/recipes/:id - Get single recipe
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const recipe = await recipeService.getRecipe(req.params.id);
    res.json(recipe);
  }),
);

// POST /api/recipes - Create recipe
router.post(
  '/',
  validate(createRecipeSchema),
  asyncHandler(async (req, res) => {
    const recipe = await recipeService.createRecipe(req.body);
    res.status(201).json(recipe);
  }),
);

// PATCH /api/recipes/:id - Update recipe (creates new version)
router.patch(
  '/:id',
  validate(updateRecipeSchema),
  asyncHandler(async (req, res) => {
    const recipe = await recipeService.updateRecipe(req.params.id, req.body);
    res.json(recipe);
  }),
);

// DELETE /api/recipes/:id - Toggle archive
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const recipe = await recipeService.archiveRecipe(req.params.id);
    res.json(recipe);
  }),
);

// DELETE /api/recipes/:id/permanent - Permanently delete all versions
router.delete(
  '/:id/permanent',
  asyncHandler(async (req, res) => {
    await recipeService.deleteRecipePermanently(req.params.id);
    res.status(204).send();
  }),
);

// GET /api/recipes/:id/export?format=json|text
router.get(
  '/:id/export',
  asyncHandler(async (req, res) => {
    const recipe = await recipeService.getRecipe(req.params.id);
    const format = (req.query.format as string) || 'json';
    const safeName = recipe.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    if (format === 'text') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.txt"`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.send(recipeToText(recipe as any));
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.json"`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.json(recipeToJson(recipe as any));
    }
  }),
);

// GET /api/recipes/:id/substitutions - Substitutions for recipe ingredients
router.get(
  '/:id/substitutions',
  asyncHandler(async (req, res) => {
    const substitutions = await getSubstitutionsForRecipe(req.params.id);
    res.json(substitutions);
  }),
);

// GET /api/recipes/:id/versions - List all versions
router.get(
  '/:id/versions',
  asyncHandler(async (req, res) => {
    const versions = await recipeService.getRecipeVersions(req.params.id);
    res.json(versions);
  }),
);

// POST /api/recipes/:id/restore/:version - Restore a version
router.post(
  '/:id/restore/:version',
  asyncHandler(async (req, res) => {
    const version = parseInt(req.params.version, 10);
    if (isNaN(version)) {
      res.status(400).json({ error: 'Invalid version number' });
      return;
    }
    const recipe = await recipeService.restoreRecipeVersion(req.params.id, version);
    res.json(recipe);
  }),
);

export default router;
