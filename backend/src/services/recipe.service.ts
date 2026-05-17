import fs from 'fs';
import path from 'path';
import { prisma } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config.js';
import type { CreateRecipeInput, UpdateRecipeInput, RecipeQueryInput } from '../schemas/recipe.schema.js';
import { updateRecipeDietaryLabels } from './dietary.service.js';
import { stemVariants } from '../utils/stemVariants.js';

type WithSteps = { steps: { timeMinutes: number | null; isActiveTime: boolean }[] };

/** Resolves an ingredient name to its catalog entry ID, or null if not in the catalog. */
async function resolveCatalogId(name: string): Promise<string | null> {
  const lower = name.toLowerCase().trim();
  const alias = await prisma.ingredientAlias.findUnique({
    where: { alias: lower },
    select: { catalogId: true },
  });
  return alias?.catalogId ?? null;
}

/** Adds catalogId to each ingredient input by looking up the alias table. */
async function withCatalogIds<T extends { name: string }>(
  ingredients: T[],
): Promise<(T & { catalogId: string | null })[]> {
  return Promise.all(
    ingredients.map(async (ing) => ({ ...ing, catalogId: await resolveCatalogId(ing.name) })),
  );
}

type IngredientFilter =
  | { catalogId: string }
  | { OR: { name: { equals: string } }[] };

/** Builds a Prisma ingredient filter for a search term.
 *  Uses catalogId when the term maps to a catalog entry; falls back to name variants. */
async function resolveIngredientFilter(name: string): Promise<IngredientFilter> {
  const catalogId = await resolveCatalogId(name);
  if (catalogId) return { catalogId };
  return { OR: stemVariants(name.toLowerCase().trim()).map((v) => ({ name: { equals: v } })) };
}

function withComputedTimes<T extends WithSteps>(recipe: T): T & { totalTime: number | null; activeTime: number | null } {
  const totalTime = Math.ceil(recipe.steps.reduce((sum, s) => sum + (s.timeMinutes ?? 0), 0)) || null;
  const activeTime = Math.ceil(recipe.steps.filter(s => s.isActiveTime).reduce((sum, s) => sum + (s.timeMinutes ?? 0), 0)) || null;
  return { ...recipe, totalTime, activeTime };
}


const recipeInclude = {
  ingredients: { orderBy: { orderIndex: 'asc' as const } },
  steps: { orderBy: { orderIndex: 'asc' as const } },
  labels: { include: { label: true } },
  courses: true,
};

export async function listRecipes(query: RecipeQueryInput) {
  const { page, limit, search, archived, includeIngredients, excludeIngredients, labels, diets, freeFrom, courses } = query;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    isLatest: true,
    archived: archived === 'true',
  };

  if (search) {
    where.title = { contains: search };
  }

  // Filter: must contain these ingredients
  if (includeIngredients) {
    const names = includeIngredients.split(',').map((s) => s.trim().toLowerCase());
    const filters = await Promise.all(names.map(resolveIngredientFilter));
    where.AND = [
      ...(where.AND || []),
      ...filters.map((f) => ({ ingredients: { some: f } })),
    ];
  }

  // Filter: must NOT contain these ingredients
  if (excludeIngredients) {
    const names = excludeIngredients.split(',').map((s) => s.trim().toLowerCase());
    const filters = await Promise.all(names.map(resolveIngredientFilter));
    where.AND = [
      ...(where.AND || []),
      ...filters.map((f) => ({ ingredients: { none: f } })),
    ];
  }

  // Filter: must have these labels
  if (labels) {
    const labelNames = labels.split(',').map((s) => s.trim());
    where.AND = [
      ...(where.AND || []),
      ...labelNames.map((name) => ({
        labels: { some: { label: { name } } },
      })),
    ];
  }

  // Filter: dietary/allergen via stored auto-generated labels (computed at save time)
  if (diets || freeFrom) {
    const filterDiets = diets ? diets.split(',').map((s) => s.trim()) : [];
    const filterFreeFrom = freeFrom ? freeFrom.split(',').map((s) => s.trim()) : [];
    where.AND = [
      ...(where.AND || []),
      ...filterDiets.map((diet) => ({
        labels: { some: { label: { type: 'dietary', name: diet } } },
      })),
      ...filterFreeFrom.map((allergen) => ({
        labels: { none: { label: { type: 'allergen', name: allergen } } },
      })),
    ];
  }

  // Filter: must have at least one of these courses
  if (courses) {
    const courseTypes = courses.split(',').map((s) => s.trim());
    where.OR = [
      ...(where.OR || []),
      ...courseTypes.map((courseType) => ({
        courses: { some: { courseType } },
      })),
    ];
  }

  const [recipes, total] = await Promise.all([
    prisma.recipe.findMany({
      where,
      include: recipeInclude,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.recipe.count({ where }),
  ]);

  return {
    recipes: recipes.map(withComputedTimes),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getRecipe(id: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: recipeInclude,
  });

  if (!recipe) {
    throw new AppError(404, 'Recipe not found');
  }

  return withComputedTimes(recipe);
}

export async function createRecipe(input: CreateRecipeInput) {
  const { ingredients, steps, ...recipeData } = input;

  const recipe = await prisma.recipe.create({
    data: {
      ...recipeData,
      version: 1,
      isLatest: true,
      ingredients: {
        create: await withCatalogIds(ingredients),
      },
      steps: {
        create: steps,
      },
    },
    include: recipeInclude,
  });

  await updateRecipeDietaryLabels(recipe.id, recipe.ingredients);
  return getRecipe(recipe.id);
}

export async function updateRecipe(id: string, input: UpdateRecipeInput) {
  const existing = await prisma.recipe.findUnique({
    where: { id },
    include: recipeInclude,
  });

  if (!existing) {
    throw new AppError(404, 'Recipe not found');
  }

  if (!existing.isLatest) {
    throw new AppError(400, 'Can only update the latest version of a recipe');
  }

  const { ingredients, steps, ...recipeData } = input;

  // Resolve catalog IDs before the transaction to avoid timeout from N async lookups inside it
  const ingredientData = ingredients
    ? await withCatalogIds(ingredients)
    : existing.ingredients.map(({ id: _id, recipeId: _rid, ...ing }) => ing);

  // Create new version with updated data
  const newRecipe = await prisma.$transaction(async (tx) => {
    // Mark old version as not latest
    await tx.recipe.update({
      where: { id },
      data: { isLatest: false },
    });

    // Create new version
    const created = await tx.recipe.create({
      data: {
        title: recipeData.title ?? existing.title,
        servings: recipeData.servings ?? existing.servings,
        source: recipeData.source !== undefined ? recipeData.source : existing.source,
        authorNotes: recipeData.authorNotes !== undefined ? recipeData.authorNotes : existing.authorNotes,
        personalNotes: recipeData.personalNotes !== undefined ? recipeData.personalNotes : existing.personalNotes,
        archived: existing.archived,
        version: existing.version + 1,
        parentId: existing.id,
        isLatest: true,
        ingredients: {
          create: ingredientData,
        },
        steps: {
          create: steps ?? existing.steps.map(({ id: _id, recipeId: _rid, ...step }) => step),
        },
      },
      include: recipeInclude,
    });

    // ── Migrate media from old version to new version ─────────────────────
    // Recipe-level media (not tied to a step)
    const recipeLevelMedia = await tx.media.findMany({
      where: { recipeId: id, stepId: null },
    });
    for (const m of recipeLevelMedia) {
      await tx.media.create({
        data: { type: m.type, path: m.path, orderIndex: m.orderIndex, recipeId: created.id },
      });
    }

    // Step-level media — match old steps to new steps by orderIndex
    const oldStepIds = existing.steps.map((s) => s.id);
    if (oldStepIds.length > 0) {
      const stepMedia = await tx.media.findMany({
        where: { stepId: { in: oldStepIds } },
      });
      if (stepMedia.length > 0) {
        const oldOrderByStepId = new Map(existing.steps.map((s) => [s.id, s.orderIndex]));
        const newStepIdByOrder = new Map(created.steps.map((s) => [s.orderIndex, s.id]));
        for (const m of stepMedia) {
          const orderIdx = oldOrderByStepId.get(m.stepId!);
          if (orderIdx === undefined) continue;
          const newStepId = newStepIdByOrder.get(orderIdx);
          if (!newStepId) continue;
          await tx.media.create({
            data: { type: m.type, path: m.path, orderIndex: m.orderIndex, stepId: newStepId },
          });
        }
      }
    }

    return created;
  });

  await updateRecipeDietaryLabels(newRecipe.id, newRecipe.ingredients);
  return getRecipe(newRecipe.id);
}

export async function archiveRecipe(id: string) {
  const existing = await prisma.recipe.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError(404, 'Recipe not found');
  }

  const recipe = await prisma.recipe.update({
    where: { id },
    data: { archived: !existing.archived },
    include: recipeInclude,
  });

  return withComputedTimes(recipe);
}

export async function getRecipeVersions(id: string) {
  // Find the recipe and trace its version chain
  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) {
    throw new AppError(404, 'Recipe not found');
  }

  // Find all versions: traverse up to root, then find all descendants
  // First find the root (oldest version)
  let rootId = id;
  let current = recipe;
  while (current.parentId) {
    rootId = current.parentId;
    const parent = await prisma.recipe.findUnique({ where: { id: rootId } });
    if (!parent) break;
    current = parent;
  }

  // Now find all versions in this chain
  const allVersions: typeof recipe[] = [];
  const queue = [rootId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const ver = await prisma.recipe.findUnique({
      where: { id: currentId },
      include: recipeInclude,
    });
    if (ver) {
      allVersions.push(ver);
      // Find children
      const children = await prisma.recipe.findMany({
        where: { parentId: currentId },
        select: { id: true },
      });
      for (const child of children) {
        queue.push(child.id);
      }
    }
  }

  // allVersions items are fetched with recipeInclude so they have steps, but the array
  // is typed from the top-level findUnique (no include). Cast to WithSteps to satisfy withComputedTimes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return allVersions.sort((a, b) => b.version - a.version).map((v) => withComputedTimes(v as any));
}

export async function restoreRecipeVersion(id: string, version: number) {
  // Find the latest version in this recipe's chain
  const versions = await getRecipeVersions(id);
  const latestVersion = versions.find((v) => v.isLatest);
  const targetVersion = versions.find((v) => v.version === version);

  if (!latestVersion) {
    throw new AppError(404, 'No latest version found');
  }

  if (!targetVersion) {
    throw new AppError(404, `Version ${version} not found`);
  }

  // Create a new version from the target version's data
  const restored = await prisma.$transaction(async (tx) => {
    await tx.recipe.update({
      where: { id: latestVersion.id },
      data: { isLatest: false },
    });

    return tx.recipe.create({
      data: {
        title: targetVersion.title,
        servings: targetVersion.servings,
        source: targetVersion.source,
        authorNotes: targetVersion.authorNotes,
        personalNotes: targetVersion.personalNotes,
        archived: latestVersion.archived,
        version: latestVersion.version + 1,
        parentId: latestVersion.id,
        isLatest: true,
        ingredients: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: targetVersion.ingredients.map(({ id: _id, recipeId: _rid, ...ing }: any) => ing),
        },
        steps: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: targetVersion.steps.map(({ id: _id, recipeId: _rid, ...step }: any) => step),
        },
      },
      include: recipeInclude,
    });
  });

  await updateRecipeDietaryLabels(restored.id, restored.ingredients);
  return getRecipe(restored.id);
}

export async function deleteRecipePermanently(id: string) {
  // Collect all versions in the chain
  const versions = await getRecipeVersions(id);
  const allIds = versions.map((v) => v.id);
  const steps = await prisma.step.findMany({ where: { recipeId: { in: allIds } }, select: { id: true } });
  const allStepIds = steps.map((s) => s.id);

  // Gather all media paths before deleting DB records
  const [recipeMedia, stepMedia] = await Promise.all([
    prisma.media.findMany({ where: { recipeId: { in: allIds } } }),
    allStepIds.length > 0
      ? prisma.media.findMany({ where: { stepId: { in: allStepIds } } })
      : Promise.resolve([]),
  ]);

  // Delete files from disk
  for (const m of [...recipeMedia, ...stepMedia]) {
    const filePath = path.join(config.MEDIA_STORAGE_PATH, path.basename(m.path));
    try { fs.unlinkSync(filePath); } catch { /* file may already be gone */ }
  }

  // Null out parentId references within the chain so deleteMany doesn't hit FK constraints,
  // then delete all versions (cascade removes ingredients, steps, media DB records).
  await prisma.$transaction(async (tx) => {
    await tx.recipe.updateMany({ where: { id: { in: allIds } }, data: { parentId: null } });
    await tx.recipe.deleteMany({ where: { id: { in: allIds } } });
  });
}
