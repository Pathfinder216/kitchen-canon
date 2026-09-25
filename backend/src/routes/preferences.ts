import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { updatePreferencesSchema } from '../schemas/preferences.schema.js';
import { getPreferences, updatePreferences } from '../services/preferences.service.js';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// GET /api/preferences — the signed-in user's preferences (row created with defaults on first read)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getPreferences(req.userId!));
  }),
);

// PATCH /api/preferences — partial update; returns the full preferences object
router.patch(
  '/',
  validate(updatePreferencesSchema),
  asyncHandler(async (req, res) => {
    res.json(await updatePreferences(req.userId!, req.body));
  }),
);

export default router;
