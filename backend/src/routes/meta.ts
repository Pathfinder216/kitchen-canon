import { Router } from 'express';
import { ALLERGENS, DIETS, ALLERGEN_LABELS, DIET_LABELS } from '../constants/dietaryTags.js';
import { AISLES, AISLE_LABELS } from '../constants/aisles.js';

const router = Router();

// GET /api/meta — the dietary vocabulary (allergens, diets, and their display labels) plus the
// grocery aisle vocabulary (`aisles` in display order, and their labels).
// This is the single source of truth for the frontend; there is no static mirror anymore.
router.get('/', (_req, res) => {
  res.json({
    allergens: ALLERGENS,
    diets: DIETS,
    allergenLabels: ALLERGEN_LABELS,
    dietLabels: DIET_LABELS,
    aisles: AISLES,
    aisleLabels: AISLE_LABELS,
  });
});

export default router;
