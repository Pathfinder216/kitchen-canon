import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { createMealPlanSchema, updateGroceryItemSchema, updateMealPlanSchema } from '../schemas/meal-plan.schema.js';
import * as mealPlanService from '../services/meal-plan.service.js';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// GET /api/meal-plans
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const mealPlans = await mealPlanService.listMealPlans();
    res.json(mealPlans);
  }),
);

// POST /api/meal-plans
router.post(
  '/',
  validate(createMealPlanSchema),
  asyncHandler(async (req, res) => {
    const mealPlan = await mealPlanService.createMealPlan(req.body);
    res.status(201).json(mealPlan);
  }),
);

// GET /api/meal-plans/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const mealPlan = await mealPlanService.getMealPlan(req.params.id);
    res.json(mealPlan);
  }),
);

// PATCH /api/meal-plans/:id — update meal plan (name, date, time, notes, recipes)
router.patch(
  '/:id',
  validate(updateMealPlanSchema),
  asyncHandler(async (req, res) => {
    const mealPlan = await mealPlanService.updateMealPlan(req.params.id, req.body);
    res.json(mealPlan);
  }),
);

// PATCH /api/meal-plans/:id/grocery/:itemId — toggle grocery item purchased
router.patch(
  '/:id/grocery/:itemId',
  validate(updateGroceryItemSchema),
  asyncHandler(async (req, res) => {
    const item = await mealPlanService.updateGroceryItem(
      req.params.id,
      req.params.itemId,
      req.body.purchased,
    );
    res.json(item);
  }),
);

// POST /api/meal-plans/:id/remake
router.post(
  '/:id/remake',
  asyncHandler(async (req, res) => {
    const mealPlan = await mealPlanService.remakeMealPlan(req.params.id);
    res.status(201).json(mealPlan);
  }),
);

export default router;
