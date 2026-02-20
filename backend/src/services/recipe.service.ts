import { prisma } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import type { CreateRecipeInput, UpdateRecipeInput, RecipeQueryInput } from '../schemas/recipe.schema.js';

const recipeInclude = {
  ingredients: { orderBy: { orderIndex: 'asc' as const } },
  steps: { orderBy: { orderIndex: 'asc' as const } },
  labels: { include: { label: true } },
  categories: { include: { category: true } },
};

export async function listRecipes(query: RecipeQueryInput) {
  const { page, limit, search, archived, includeIngredients, excludeIngredients, labels, categories } = query;
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
    const ingredientNames = includeIngredients.split(',').map((s) => s.trim().toLowerCase());
    where.AND = [
      ...(where.AND || []),
      ...ingredientNames.map((name) => ({
        ingredients: { some: { name: { contains: name } } },
      })),
    ];
  }

  // Filter: must NOT contain these ingredients
  if (excludeIngredients) {
    const excludeNames = excludeIngredients.split(',').map((s) => s.trim().toLowerCase());
    where.AND = [
      ...(where.AND || []),
      ...excludeNames.map((name) => ({
        ingredients: { none: { name: { contains: name } } },
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

  // Filter: must have these categories
  if (categories) {
    const categoryNames = categories.split(',').map((s) => s.trim());
    where.AND = [
      ...(where.AND || []),
      ...categoryNames.map((name) => ({
        categories: { some: { category: { name } } },
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
    recipes,
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

  return recipe;
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

  return recipe;
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
    return tx.recipe.create({
      data: {
        title: recipeData.title ?? existing.title,
        servings: recipeData.servings ?? existing.servings,
        totalTime: recipeData.totalTime !== undefined ? recipeData.totalTime : existing.totalTime,
        activeTime: recipeData.activeTime !== undefined ? recipeData.activeTime : existing.activeTime,
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
  });

  return newRecipe;
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

  return recipe;
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

  return allVersions.sort((a, b) => a.version - b.version);
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
        totalTime: targetVersion.totalTime,
        activeTime: targetVersion.activeTime,
        source: targetVersion.source,
        authorNotes: targetVersion.authorNotes,
        personalNotes: targetVersion.personalNotes,
        archived: latestVersion.archived,
        version: latestVersion.version + 1,
        parentId: latestVersion.id,
        isLatest: true,
        ingredients: {
          create: targetVersion.ingredients.map(({ id: _id, recipeId: _rid, ...ing }) => ing),
        },
        steps: {
          create: targetVersion.steps.map(({ id: _id, recipeId: _rid, ...step }) => step),
        },
      },
      include: recipeInclude,
    });
  });

  return restored;
}
