import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { getFood, isNutritionLookupConfigured, searchFoods } from '../services/nutrition.service.js';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// GET /api/nutrition/status — whether the USDA lookup is available (the UI hides it otherwise).
router.get('/status', (_req, res) => {
  res.json({ lookupConfigured: isNutritionLookupConfigured() });
});

// GET /api/nutrition/search?q= — top USDA FoodData Central matches, normalized to per-100 g.
// 503 when no FDC_API_KEY is configured; 502 when FDC fails or times out.
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) throw new AppError(400, 'q is required');
    if (q.length > 100) throw new AppError(400, 'q must be at most 100 characters');
    res.json(await searchFoods(q));
  }),
);

// GET /api/nutrition/food/:fdcId — one FDC food including portions (gramsPerUnit).
router.get(
  '/food/:fdcId',
  asyncHandler(async (req, res) => {
    const raw = req.params.fdcId as string;
    const fdcId = Number(raw);
    if (!/^\d{1,10}$/.test(raw) || !Number.isSafeInteger(fdcId) || fdcId <= 0) {
      throw new AppError(400, 'fdcId must be a positive integer');
    }
    res.json(await getFood(fdcId));
  }),
);

export default router;
