import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { ALLERGENS, DIETS } from '../constants/dietaryTags.js';
import { stemVariants } from '../utils/stemVariants.js';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

const aliasInclude = { aliases: { orderBy: { alias: 'asc' as const } } };

const createSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.toLowerCase().trim()),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
  diets: z.array(z.enum(DIETS)).default([]),
});

const updateSchema = z.object({
  allergens: z.array(z.enum(ALLERGENS)),
  diets: z.array(z.enum(DIETS)),
});

// GET /api/ingredients?q= — typeahead / full list (global catalog plus the user's own)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase().trim() : '';
    const ownership = { OR: [{ userId: null }, { userId: req.userId }] };
    const where = q
      ? {
          AND: [
            ownership,
            { OR: [{ displayAlias: { contains: q } }, { aliases: { some: { alias: { contains: q } } } }] },
          ],
        }
      : ownership;
    const entries = await prisma.ingredientCatalog.findMany({
      where,
      orderBy: { displayAlias: 'asc' },
      include: aliasInclude,
    });
    res.json(entries);
  }),
);

// POST /api/ingredients — add or update the user's own catalog entry by name
router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const { name, allergens, diets } = req.body as z.infer<typeof createSchema>;
    const userId = req.userId!;

    // If this name is already one of the user's own aliases, update that private entry.
    const ownAlias = await prisma.ingredientAlias.findFirst({
      where: { alias: name, userId },
      include: { catalog: true },
    });
    if (ownAlias) {
      const entry = await prisma.ingredientCatalog.update({
        where: { id: ownAlias.catalogId },
        data: { allergens, diets },
        include: aliasInclude,
      });
      res.json(entry);
      return;
    }

    // New private entry — create with stem-variant aliases scoped to the user. This may shadow a
    // global entry of the same name; resolution prefers the user's own entry.
    const entry = await prisma.ingredientCatalog.create({
      data: { displayAlias: name, allergens, diets, isUserAdded: true, userId },
    });
    const variants = [...new Set(stemVariants(name))];
    for (const alias of variants) {
      // Dedupe against the user's existing private aliases (null-userId globals don't conflict).
      const exists = await prisma.ingredientAlias.findFirst({ where: { alias, userId } });
      if (!exists) {
        await prisma.ingredientAlias.create({ data: { alias, catalogId: entry.id, userId } });
      }
    }
    const result = await prisma.ingredientCatalog.findUniqueOrThrow({
      where: { id: entry.id },
      include: aliasInclude,
    });
    res.status(201).json(result);
  }),
);

// PATCH /api/ingredients/:id — update tags for one of the user's own entries
router.patch(
  '/:id',
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const { allergens, diets } = req.body as z.infer<typeof updateSchema>;
    const existing = await prisma.ingredientCatalog.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });
    if (!existing) throw new AppError(404, 'Ingredient not found');
    const entry = await prisma.ingredientCatalog.update({
      where: { id: req.params.id as string },
      data: { allergens, diets },
      include: aliasInclude,
    });
    res.json(entry);
  }),
);

// DELETE /api/ingredients/:id — remove one of the user's own entries and its aliases
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.ingredientCatalog.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });
    if (!existing) throw new AppError(404, 'Ingredient not found');
    await prisma.ingredientCatalog.delete({ where: { id: req.params.id as string } });
    res.status(204).end();
  }),
);

export default router;
