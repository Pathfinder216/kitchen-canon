import fs from 'fs';
import path from 'path';
import { prisma } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config.js';
import type { CreateRecipeInput, UpdateRecipeInput, RecipeQueryInput } from '../schemas/recipe.schema.js';
import { getAliasGroup } from '../utils/ingredientAliases.js';
import { updateRecipeDietaryLabels } from './dietary.service.js';

type WithSteps = { steps: { timeMinutes: number | null; isActiveTime: boolean }[] };

/** Returns singular/plural variants for ingredient matching */
function stemVariants(word: string): string[] {
  const w = word.toLowerCase();
  const variants = new Set([w]);

  // Determine base (singular) form
  let base = w;
  if (w.endsWith('ies') && w.length > 4) {
    base = w.slice(0, -3) + 'y';  // berries → berry
  } else if (w.endsWith('ves') && w.length > 4) {
    base = w.slice(0, -3) + 'f';  // halves → half
    variants.add(w.slice(0, -3) + 'fe'); // knives → knife
  } else if (w.endsWith('es') && w.length > 4) {
    base = w.slice(0, -2);         // tomatoes → tomato
  } else if (w.endsWith('s') && w.length > 3) {
    base = w.slice(0, -1);         // lemons → lemon
  }
  variants.add(base);

  // Also expand base into common plural forms
  variants.add(base + 's');                            // lemon → lemons
  if (base.endsWith('y')) variants.add(base.slice(0, -1) + 'ies'); // berry → berries
  if (base.endsWith('f')) variants.add(base.slice(0, -1) + 'ves'); // half → halves
  if (base.endsWith('fe')) variants.add(base.slice(0, -2) + 'ves'); // knife → knives
  if (base.endsWith('o')) variants.add(base + 'es');  // tomato → tomatoes

  return [...variants];
}

/**
 * Returns all DB-matchable name variants for an ingredient search term:
 * stem variants of the term itself, plus stem variants of every alias.
 */
function ingredientSearchVariants(name: string): string[] {
  const aliases = getAliasGroup(name);
  const all = new Set<string>();
  for (const alias of aliases) {
    for (const v of stemVariants(alias)) {
      all.add(v);
    }
  }
  return [...all];
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

  // Filter: must contain these ingredients (word-boundary match, handles plurals)
  if (includeIngredients) {
    const ingredientNames = includeIngredients.split(',').map((s) => s.trim().toLowerCase());
    where.AND = [
      ...(where.AND || []),
      ...ingredientNames.map((name) => ({
        ingredients: {
          some: { OR: ingredientSearchVariants(name).map((v) => ({ name: { equals: v } })) },
        },
      })),
    ];
  }

  // Filter: must NOT contain these ingredients (word-boundary match, handles plurals)
  if (excludeIngredients) {
    const excludeNames = excludeIngredients.split(',').map((s) => s.trim().toLowerCase());
    where.AND = [
      ...(where.AND || []),
      ...excludeNames.map((name) => ({
        ingredients: {
          none: { OR: ingredientSearchVariants(name).map((v) => ({ name: { equals: v } })) },
        },
      })),
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
        create: ingredients,
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
          create: ingredients ?? existing.ingredients.map(({ id: _id, recipeId: _rid, ...ing }) => ing),
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
