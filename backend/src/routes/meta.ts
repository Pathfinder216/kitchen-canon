import { Router } from 'express';
import { ALLERGENS, DIETS, ALLERGEN_LABELS, DIET_LABELS } from '../constants/dietaryTags.js';

const router = Router();

// GET /api/meta — the dietary vocabulary (allergens, diets, and their display labels).
// This is the single source of truth for the frontend; there is no static mirror anymore.
router.get('/', (_req, res) => {
  res.json({
    allergens: ALLERGENS,
    diets: DIETS,
    allergenLabels: ALLERGEN_LABELS,
    dietLabels: DIET_LABELS,
  });
});

export default router;
