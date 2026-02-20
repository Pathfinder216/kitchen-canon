import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import * as substitutionService from '../services/substitutions.service.js';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

const createSchema = z.object({
  fromIngredient: z.string().min(1).max(200),
  toIngredient: z.string().min(1).max(200),
  ratio: z.number().positive(),
  notes: z.string().max(500).optional(),
  isOfficial: z.boolean().optional(),
});

// GET /api/substitutions?from=butter
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const from = req.query.from as string | undefined;
    const substitutions = await substitutionService.listSubstitutions(from);
    res.json(substitutions);
  }),
);

// POST /api/substitutions
router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const sub = await substitutionService.createSubstitution(req.body);
    res.status(201).json(sub);
  }),
);

// DELETE /api/substitutions/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await substitutionService.deleteSubstitution(req.params.id);
    res.status(204).send();
  }),
);

export default router;
