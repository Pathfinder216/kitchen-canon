import { prisma } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { consolidateIngredients } from './grocery.service.js';
import { computeDietaryInfo } from './dietary.service.js';
import type { CreateMealPlanInput, UpdateMealPlanInput } from '../schemas/meal-plan.schema.js';

const mealPlanInclude = {
  recipes: {
    include: {
      recipe: {
        include: {
          ingredients: { orderBy: { orderIndex: 'asc' as const } },
          steps: { orderBy: { orderIndex: 'asc' as const } },
        },
      },
    },
    orderBy: { orderIndex: 'asc' as const },
  },
  groceryList: true,
};

export async function listMealPlans() {
  return prisma.mealPlan.findMany({
    include: {
      recipes: {
        include: { recipe: { select: { id: true, title: true, servings: true } } },
        orderBy: { orderIndex: 'asc' as const },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getMealPlan(id: string) {
  const mealPlan = await prisma.mealPlan.findUnique({
    where: { id },
    include: mealPlanInclude,
  });

  if (!mealPlan) throw new AppError(404, 'Meal plan not found');

  const stored = mealPlan.dietaryInfo as { unknownIngredients?: string[] } | null;
  if (stored?.unknownIngredients && stored.unknownIngredients.length > 0) {
    const recipeInputs = mealPlan.recipes.map((mr) => ({
      recipeId: mr.recipeId,
      servings: mr.servings,
      substitutions: mr.substitutions ? (mr.substitutions as Record<string, { toIngredient: string; ratio: number }>) : undefined,
    }));
    const recipes = mealPlan.recipes.map((mr) => mr.recipe);
    const freshInfo = await computeDietaryInfo(effectiveIngredients(recipeInputs, recipes));
    if (freshInfo.unknownIngredients.length !== stored.unknownIngredients.length) {
      await prisma.mealPlan.update({ where: { id }, data: { dietaryInfo: freshInfo as object } });
      return { ...mealPlan, dietaryInfo: freshInfo };
    }
  }

  return mealPlan;
}

type RecipeWithIngredients = { id: string; version: number; servings: number; ingredients: { id: string; name: string; isOptional: boolean; amount: number | null; unit: string | null }[] };

function effectiveIngredients(
  recipeInputs: CreateMealPlanInput['recipes'],
  recipes: RecipeWithIngredients[],
): { name: string; isOptional: boolean }[] {
  const seen = new Set<string>();
  const result: { name: string; isOptional: boolean }[] = [];
  for (const r of recipeInputs) {
    const recipe = recipes.find((rec) => rec.id === r.recipeId)!;
    const subs = (r.substitutions ?? {}) as Record<string, { toIngredient: string; ratio: number }>;
    for (const ing of recipe.ingredients) {
      const name = subs[ing.id]?.toIngredient ?? ing.name;
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ name, isOptional: ing.isOptional });
      }
    }
  }
  return result;
}

export async function createMealPlan(input: CreateMealPlanInput) {
  // Verify all recipes exist and get their data
  const recipeIds = input.recipes.map((r) => r.recipeId);
  const recipes = await prisma.recipe.findMany({
    where: { id: { in: recipeIds } },
    include: { ingredients: true },
  });

  if (recipes.length !== recipeIds.length) {
    throw new AppError(400, 'One or more recipes not found');
  }

  // Generate consolidated grocery list (applying substitutions)
  const groceryItems = consolidateIngredients(
    input.recipes.map((r) => {
      const recipe = recipes.find((rec) => rec.id === r.recipeId)!;
      const subs = (r.substitutions ?? {}) as Record<string, { toIngredient: string; ratio: number }>;
      return {
        ingredients: recipe.ingredients.map((ing) => {
          const sub = subs[ing.id];
          if (sub) {
            return {
              name: sub.toIngredient,
              amount: ing.amount !== null ? ing.amount * sub.ratio : null,
              unit: ing.unit,
            };
          }
          return ing;
        }),
        servingsMultiplier: r.servings / recipe.servings,
      };
    }),
  );

  const dietaryInfo = await computeDietaryInfo(effectiveIngredients(input.recipes, recipes));

  // Create meal plan with recipes and grocery list
  const mealPlan = await prisma.mealPlan.create({
    data: {
      name: input.name,
      date: input.date,
      time: input.time,
      notes: input.notes,
      dietaryInfo: dietaryInfo as object,
      recipes: {
        create: input.recipes.map((r, index) => ({
          recipeId: r.recipeId,
          recipeVersion: recipes.find((rec) => rec.id === r.recipeId)!.version,
          servings: r.servings,
          orderIndex: r.orderIndex ?? index,
          substitutions: r.substitutions ?? undefined,
        })),
      },
      groceryList: {
        create: groceryItems,
      },
    },
    include: mealPlanInclude,
  });

  return mealPlan;
}

export async function updateMealPlan(id: string, input: UpdateMealPlanInput) {
  const existing = await prisma.mealPlan.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Meal plan not found');

  if (input.recipes) {
    // Recipes changed — recalculate grocery list inside a transaction
    const recipeIds = input.recipes.map((r) => r.recipeId);
    const recipes = await prisma.recipe.findMany({
      where: { id: { in: recipeIds } },
      include: { ingredients: true },
    });
    if (recipes.length !== recipeIds.length) {
      throw new AppError(400, 'One or more recipes not found');
    }

    const groceryItems = consolidateIngredients(
      input.recipes.map((r) => {
        const recipe = recipes.find((rec) => rec.id === r.recipeId)!;
        const subs = (r.substitutions ?? {}) as Record<string, { toIngredient: string; ratio: number }>;
        return {
          ingredients: recipe.ingredients.map((ing) => {
            const sub = subs[ing.id];
            if (sub) {
              return {
                name: sub.toIngredient,
                amount: ing.amount !== null ? ing.amount * sub.ratio : null,
                unit: ing.unit,
              };
            }
            return ing;
          }),
          servingsMultiplier: r.servings / recipe.servings,
        };
      }),
    );

    const dietaryInfo = await computeDietaryInfo(effectiveIngredients(input.recipes, recipes));

    await prisma.$transaction([
      prisma.mealRecipe.deleteMany({ where: { mealPlanId: id } }),
      prisma.groceryItem.deleteMany({ where: { mealPlanId: id } }),
      prisma.mealPlan.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.date !== undefined && { date: input.date }),
          ...(input.time !== undefined && { time: input.time }),
          ...(input.notes !== undefined && { notes: input.notes }),
          dietaryInfo: dietaryInfo as object,
          recipes: {
            create: input.recipes.map((r, index) => ({
              recipeId: r.recipeId,
              recipeVersion: recipes.find((rec) => rec.id === r.recipeId)!.version,
              servings: r.servings,
              orderIndex: r.orderIndex ?? index,
              substitutions: r.substitutions ?? undefined,
            })),
          },
          groceryList: { create: groceryItems },
        },
      }),
    ]);
  } else {
    await prisma.mealPlan.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.date !== undefined && { date: input.date }),
        ...(input.time !== undefined && { time: input.time }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
  }

  return getMealPlan(id);
}

export async function updateGroceryItem(mealPlanId: string, itemId: string, purchased: boolean) {
  const item = await prisma.groceryItem.findFirst({
    where: { id: itemId, mealPlanId },
  });

  if (!item) throw new AppError(404, 'Grocery item not found');

  return prisma.groceryItem.update({
    where: { id: itemId },
    data: { purchased },
  });
}

export async function recalculateDietaryInfo(id: string) {
  const mealPlan = await prisma.mealPlan.findUnique({
    where: { id },
    include: {
      recipes: {
        include: {
          recipe: { include: { ingredients: true } },
        },
      },
    },
  });

  if (!mealPlan) throw new AppError(404, 'Meal plan not found');

  const recipeInputs = mealPlan.recipes.map((mr) => ({
    recipeId: mr.recipeId,
    servings: mr.servings,
    substitutions: mr.substitutions ? (mr.substitutions as Record<string, { toIngredient: string; ratio: number }>) : undefined,
  }));
  const recipes = mealPlan.recipes.map((mr) => mr.recipe);
  const dietaryInfo = await computeDietaryInfo(effectiveIngredients(recipeInputs, recipes));

  return prisma.mealPlan.update({
    where: { id },
    data: { dietaryInfo: dietaryInfo as object },
    include: mealPlanInclude,
  });
}

export async function remakeMealPlan(id: string) {
  const original = await prisma.mealPlan.findUnique({
    where: { id },
    include: {
      recipes: true,
      groceryList: true,
    },
  });

  if (!original) throw new AppError(404, 'Meal plan not found');

  // Create a new meal plan with the same recipes
  const input: CreateMealPlanInput = {
    name: original.name ? `${original.name} (remake)` : undefined,
    recipes: original.recipes.map((r) => ({
      recipeId: r.recipeId,
      servings: r.servings,
      orderIndex: r.orderIndex ?? undefined,
      substitutions: (r.substitutions as Record<string, { toIngredient: string; ratio: number }> | null) ?? undefined,
    })),
  };

  return createMealPlan(input);
}
