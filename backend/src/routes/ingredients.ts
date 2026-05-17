import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { ALLERGENS, DIETS } from '../constants/dietaryTags.js';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

const createSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.toLowerCase().trim()),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
  diets: z.array(z.enum(DIETS)).default([]),
});

const updateSchema = z.object({
  allergens: z.array(z.enum(ALLERGENS)),
  diets: z.array(z.enum(DIETS)),
});

// GET /api/ingredients?q= — typeahead / full list
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase().trim() : '';
    const where = q ? { name: { contains: q } } : {};
    const entries = await prisma.ingredientCatalog.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    res.json(entries);
  }),
);

// POST /api/ingredients — add user-defined catalog entry
router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const { name, allergens, diets } = req.body as z.infer<typeof createSchema>;
    const existing = await prisma.ingredientCatalog.findUnique({ where: { name } });
    if (existing) {
      const entry = await prisma.ingredientCatalog.update({
        where: { name },
        data: { allergens, diets },
      });
      res.json(entry);
      return;
    }
    const entry = await prisma.ingredientCatalog.create({
      data: { name, allergens, diets, isUserAdded: true },
    });
    res.status(201).json(entry);
  }),
);

// PATCH /api/ingredients/:id — update tags for an existing entry
router.patch(
  '/:id',
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const { allergens, diets } = req.body as z.infer<typeof updateSchema>;
    const existing = await prisma.ingredientCatalog.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError(404, 'Ingredient not found');
    const entry = await prisma.ingredientCatalog.update({
      where: { id: req.params.id as string },
      data: { allergens, diets },
    });
    res.json(entry);
  }),
);

export default router;
