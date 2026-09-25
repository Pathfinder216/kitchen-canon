import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { ALLERGENS, DIETS } from '../constants/dietaryTags.js';
import { AISLES } from '../constants/aisles.js';
import { stemVariants } from '../utils/stemVariants.js';
import { SUGGEST_THRESHOLD, TYPEAHEAD_THRESHOLD } from '../utils/fuzzy.js';
import { fuzzyCatalogMatches } from '../services/catalog-fuzzy.service.js';
import { nutritionSchema, type NutritionData } from '../schemas/nutrition.schema.js';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

const aliasInclude = { aliases: { orderBy: { alias: 'asc' as const } } };

const createSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.toLowerCase().trim()),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
  diets: z.array(z.enum(DIETS)).default([]),
  // Grocery aisle. Omitted = keep the existing value (or, for a new shadow of a built-in entry,
  // inherit the built-in's aisle); null = unassigned.
  aisle: z.enum(AISLES).nullable().optional(),
  // Nutrition (plan 34). Omitted = keep the existing value (a new shadow of a built-in inherits
  // the built-in's); null = clear.
  nutrition: nutritionSchema.nullable().optional(),
});

/** Prisma write value for an optional/nullable nutrition field (Json? needs DbNull to clear). */
function nutritionWrite(n: NutritionData | null | undefined) {
  if (n === undefined) return {};
  return { nutrition: n === null ? Prisma.DbNull : (n as Prisma.InputJsonValue) };
}

/** Below this many substring hits, typeahead appends fuzzy (typo-tolerant) matches. */
const TYPEAHEAD_FUZZY_BELOW = 5;
/** Fuzzy-matching a 1–2 character query is noise; substring matching covers it. */
const FUZZY_MIN_QUERY_LENGTH = 3;

const updateSchema = z.object({
  allergens: z.array(z.enum(ALLERGENS)),
  diets: z.array(z.enum(DIETS)),
  aisle: z.enum(AISLES).nullable().optional(),
  nutrition: nutritionSchema.nullable().optional(),
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
    // Few substring hits (e.g. a typo like "tomatos"): append fuzzy matches, best first.
    if (q.length >= FUZZY_MIN_QUERY_LENGTH && entries.length < TYPEAHEAD_FUZZY_BELOW) {
      const seen = new Set(entries.map((e) => e.id));
      const fuzzy = await fuzzyCatalogMatches(req.userId!, q, TYPEAHEAD_THRESHOLD);
      entries.push(...fuzzy.map((m) => m.item).filter((e) => !seen.has(e.id)));
    }
    res.json(entries);
  }),
);

// GET /api/ingredients/suggest?name= — top-3 "Did you mean …?" catalog matches for a name that
// doesn't resolve. Suggestions only: nothing is linked or classified until the user confirms.
router.get(
  '/suggest',
  asyncHandler(async (req, res) => {
    const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    if (!name) throw new AppError(400, 'name is required');
    const matches = await fuzzyCatalogMatches(req.userId!, name.slice(0, 100), SUGGEST_THRESHOLD);
    res.json(
      matches.slice(0, 3).map(({ item, score }) => ({
        id: item.id,
        displayAlias: item.displayAlias,
        allergens: item.allergens,
        diets: item.diets,
        aisle: item.aisle,
        nutrition: item.nutrition,
        score: Math.round(score * 1000) / 1000,
      })),
    );
  }),
);

// POST /api/ingredients — add or update the user's own catalog entry by name
router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const { name, allergens, diets, aisle, nutrition } = req.body as z.infer<typeof createSchema>;
    const userId = req.userId!;

    // If this name is already one of the user's own aliases, update that private entry.
    const ownAlias = await prisma.ingredientAlias.findFirst({
      where: { alias: name, userId },
      include: { catalog: true },
    });
    if (ownAlias) {
      const entry = await prisma.ingredientCatalog.update({
        where: { id: ownAlias.catalogId },
        data: { allergens, diets, ...(aisle !== undefined && { aisle }), ...nutritionWrite(nutrition) },
        include: aliasInclude,
      });
      res.json(entry);
      return;
    }

    // A new private entry that shadows a built-in inherits the built-in's aisle and nutrition
    // unless given, so customizing only the dietary tags doesn't drop the item into "Other" or
    // lose its nutrition data.
    let resolvedAisle: string | null | undefined = aisle;
    let resolvedNutrition: NutritionData | null | undefined = nutrition;
    if (resolvedAisle === undefined || resolvedNutrition === undefined) {
      const globalAlias = await prisma.ingredientAlias.findFirst({
        where: { alias: name, userId: null },
        include: { catalog: { select: { aisle: true, nutrition: true } } },
      });
      if (resolvedAisle === undefined) resolvedAisle = globalAlias?.catalog.aisle ?? null;
      if (resolvedNutrition === undefined) {
        resolvedNutrition = (globalAlias?.catalog.nutrition as NutritionData | null | undefined) ?? null;
      }
    }

    // New private entry — create with stem-variant aliases scoped to the user. This may shadow a
    // global entry of the same name; resolution prefers the user's own entry.
    const entry = await prisma.ingredientCatalog.create({
      data: {
        displayAlias: name,
        allergens,
        diets,
        aisle: resolvedAisle,
        ...nutritionWrite(resolvedNutrition),
        isUserAdded: true,
        userId,
      },
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

// PATCH /api/ingredients/:id — update tags/aisle/nutrition for one of the user's own entries
router.patch(
  '/:id',
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const { allergens, diets, aisle, nutrition } = req.body as z.infer<typeof updateSchema>;
    const existing = await prisma.ingredientCatalog.findFirst({
      where: { id: req.params.id as string, userId: req.userId },
    });
    if (!existing) throw new AppError(404, 'Ingredient not found');
    const entry = await prisma.ingredientCatalog.update({
      where: { id: req.params.id as string },
      data: { allergens, diets, ...(aisle !== undefined && { aisle }), ...nutritionWrite(nutrition) },
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
