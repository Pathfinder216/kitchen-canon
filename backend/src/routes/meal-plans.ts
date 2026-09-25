import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import {
  createMealPlanSchema,
  suggestionsQuerySchema,
  timelineQuerySchema,
  updateGroceryItemSchema,
  updateMealPlanSchema,
} from '../schemas/meal-plan.schema.js';
import * as mealPlanService from '../services/meal-plan.service.js';
import * as suggestionsService from '../services/suggestions.service.js';
import * as timelineService from '../services/timeline.service.js';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// GET /api/meal-plans
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const mealPlans = await mealPlanService.listMealPlans(req.userId!);
    res.json(mealPlans);
  }),
);

// POST /api/meal-plans
router.post(
  '/',
  validate(createMealPlanSchema),
  asyncHandler(async (req, res) => {
    const mealPlan = await mealPlanService.createMealPlan(req.userId!, req.body);
    res.status(201).json(mealPlan);
  }),
);

// GET /api/meal-plans/suggestions?recipeIds=a,b&diets=vegetarian&freeFrom=dairy — recipes that
// complement the current selection. Registered before `/:id` so "suggestions" isn't read as an id.
router.get(
  '/suggestions',
  asyncHandler(async (req, res) => {
    const query = suggestionsQuerySchema.parse(req.query);
    const suggestions = await suggestionsService.getSuggestions(req.userId!, query);
    res.json(suggestions);
  }),
);

// GET /api/meal-plans/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const mealPlan = await mealPlanService.getMealPlan(req.userId!, req.params.id as string);
    res.json(mealPlan);
  }),
);

// GET /api/meal-plans/:id/timeline?serveAt=<ISO> — cooking schedule ending at serveAt
router.get(
  '/:id/timeline',
  asyncHandler(async (req, res) => {
    const { serveAt } = timelineQuerySchema.parse(req.query);
    const timeline = await timelineService.getMealPlanTimeline(req.userId!, req.params.id as string, serveAt);
    res.json(timeline);
  }),
);

// PATCH /api/meal-plans/:id — update meal plan (name, date, time, notes, recipes)
router.patch(
  '/:id',
  validate(updateMealPlanSchema),
  asyncHandler(async (req, res) => {
    const mealPlan = await mealPlanService.updateMealPlan(req.userId!, req.params.id as string, req.body);
    res.json(mealPlan);
  }),
);

// PATCH /api/meal-plans/:id/grocery/:itemId — toggle grocery item purchased
router.patch(
  '/:id/grocery/:itemId',
  validate(updateGroceryItemSchema),
  asyncHandler(async (req, res) => {
    const item = await mealPlanService.updateGroceryItem(
      req.userId!,
      req.params.id as string,
      req.params.itemId as string,
      req.body.purchased,
    );
    res.json(item);
  }),
);

// POST /api/meal-plans/:id/recalculate — recompute dietaryInfo from current catalog
router.post(
  '/:id/recalculate',
  asyncHandler(async (req, res) => {
    const mealPlan = await mealPlanService.recalculateDietaryInfo(req.userId!, req.params.id as string);
    res.json(mealPlan);
  }),
);

// POST /api/meal-plans/:id/remake
router.post(
  '/:id/remake',
  asyncHandler(async (req, res) => {
    const mealPlan = await mealPlanService.remakeMealPlan(req.userId!, req.params.id as string);
    res.status(201).json(mealPlan);
  }),
);

export default router;
