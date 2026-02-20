import { prisma } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';

export interface CreateSubstitutionInput {
  fromIngredient: string;
  toIngredient: string;
  ratio: number;
  notes?: string;
  isOfficial?: boolean;
}

export async function listSubstitutions(fromIngredient?: string) {
  // Normalize to lowercase for case-insensitive matching (SQLite doesn't support Prisma's mode:'insensitive')
  const where = fromIngredient
    ? { fromIngredient: fromIngredient.toLowerCase() }
    : {};
  return prisma.ingredientSubstitution.findMany({
    where,
    orderBy: [{ isOfficial: 'desc' }, { fromIngredient: 'asc' }],
  });
}

export async function createSubstitution(input: CreateSubstitutionInput) {
  return prisma.ingredientSubstitution.create({
    data: {
      ...input,
      // Normalize to lowercase for consistent matching
      fromIngredient: input.fromIngredient.toLowerCase(),
      toIngredient: input.toIngredient.toLowerCase(),
    },
  });
}

export async function deleteSubstitution(id: string) {
  const existing = await prisma.ingredientSubstitution.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Substitution not found');
  return prisma.ingredientSubstitution.delete({ where: { id } });
}

export async function getSubstitutionsForRecipe(recipeId: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: { ingredients: true },
  });
  if (!recipe) throw new AppError(404, 'Recipe not found');

  const ingredientNames = recipe.ingredients.map((i) => i.name.toLowerCase());
  if (ingredientNames.length === 0) return [];

  return prisma.ingredientSubstitution.findMany({
    where: { fromIngredient: { in: ingredientNames } },
    orderBy: [{ isOfficial: 'desc' }, { fromIngredient: 'asc' }],
  });
}
