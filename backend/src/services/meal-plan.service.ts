import { prisma } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { consolidateIngredients } from './grocery.service.js';
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
  return mealPlan;
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

  // Generate consolidated grocery list
  const groceryItems = consolidateIngredients(
    input.recipes.map((r) => {
      const recipe = recipes.find((rec) => rec.id === r.recipeId)!;
      return {
        ingredients: recipe.ingredients,
        servingsMultiplier: r.servings / recipe.servings,
      };
    }),
  );

  // Create meal plan with recipes and grocery list
  const mealPlan = await prisma.mealPlan.create({
    data: {
      name: input.name,
      date: input.date,
      time: input.time,
      notes: input.notes,
      recipes: {
        create: input.recipes.map((r, index) => ({
          recipeId: r.recipeId,
          recipeVersion: recipes.find((rec) => rec.id === r.recipeId)!.version,
          servings: r.servings,
          orderIndex: r.orderIndex ?? index,
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
        return { ingredients: recipe.ingredients, servingsMultiplier: r.servings / recipe.servings };
      }),
    );

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
          recipes: {
            create: input.recipes.map((r, index) => ({
              recipeId: r.recipeId,
              recipeVersion: recipes.find((rec) => rec.id === r.recipeId)!.version,
              servings: r.servings,
              orderIndex: r.orderIndex ?? index,
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
    })),
  };

  return createMealPlan(input);
}
