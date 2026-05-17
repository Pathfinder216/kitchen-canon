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

// GET /api/ingredients?q= — typeahead / full list
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase().trim() : '';
    const where = q
      ? { OR: [{ displayAlias: { contains: q } }, { aliases: { some: { alias: { contains: q } } } }] }
      : {};
    const entries = await prisma.ingredientCatalog.findMany({
      where,
      orderBy: { displayAlias: 'asc' },
      include: aliasInclude,
    });
    res.json(entries);
  }),
);

// POST /api/ingredients — add or update a catalog entry by name
router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const { name, allergens, diets } = req.body as z.infer<typeof createSchema>;

    // If this name is already an alias, update the entry it points to
    const existingAlias = await prisma.ingredientAlias.findUnique({
      where: { alias: name },
      include: { catalog: true },
    });
    if (existingAlias) {
      const entry = await prisma.ingredientCatalog.update({
        where: { id: existingAlias.catalogId },
        data: { allergens, diets },
        include: aliasInclude,
      });
      res.json(entry);
      return;
    }

    // New entry — create with stem-variant aliases
    const entry = await prisma.ingredientCatalog.create({
      data: { displayAlias: name, allergens, diets, isUserAdded: true },
    });
    const variants = [...new Set(stemVariants(name))];
    for (const alias of variants) {
      await prisma.ingredientAlias.upsert({
        where: { alias },
        update: {},
        create: { alias, catalogId: entry.id },
      });
    }
    const result = await prisma.ingredientCatalog.findUniqueOrThrow({
      where: { id: entry.id },
      include: aliasInclude,
    });
    res.status(201).json(result);
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
      include: aliasInclude,
    });
    res.json(entry);
  }),
);

export default router;
