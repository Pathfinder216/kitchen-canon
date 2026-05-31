import { prisma } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';

export interface CreateSubstitutionInput {
  fromIngredient: string;
  toIngredient: string;
  ratio: number;
  notes?: string;
}

/** Visible substitutions for a user: official/global ones plus the user's own. */
function ownershipFilter(userId: string) {
  return { OR: [{ isOfficial: true }, { createdBy: userId }] };
}

export async function listSubstitutions(userId: string, fromIngredient?: string) {
  // Normalize to lowercase for case-insensitive matching (SQLite doesn't support Prisma's mode:'insensitive')
  return prisma.ingredientSubstitution.findMany({
    where: {
      ...ownershipFilter(userId),
      ...(fromIngredient ? { fromIngredient: fromIngredient.toLowerCase() } : {}),
    },
    orderBy: [{ isOfficial: 'desc' }, { fromIngredient: 'asc' }],
  });
}

export async function createSubstitution(userId: string, input: CreateSubstitutionInput) {
  return prisma.ingredientSubstitution.create({
    data: {
      ...input,
      // Normalize to lowercase for consistent matching
      fromIngredient: input.fromIngredient.toLowerCase(),
      toIngredient: input.toIngredient.toLowerCase(),
      createdBy: userId,
      isOfficial: false,
    },
  });
}

export async function deleteSubstitution(userId: string, id: string) {
  // Only the user's own substitutions are deletable; official/global ones are not (→ 404).
  const existing = await prisma.ingredientSubstitution.findFirst({
    where: { id, createdBy: userId },
  });
  if (!existing) throw new AppError(404, 'Substitution not found');
  return prisma.ingredientSubstitution.delete({ where: { id } });
}

export async function getSubstitutionsForRecipe(userId: string, recipeId: string) {
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, userId },
    include: { ingredients: true },
  });
  if (!recipe) throw new AppError(404, 'Recipe not found');

  const ingredientNames = recipe.ingredients.map((i) => i.name.toLowerCase());
  if (ingredientNames.length === 0) return [];

  return prisma.ingredientSubstitution.findMany({
    where: { fromIngredient: { in: ingredientNames }, ...ownershipFilter(userId) },
    orderBy: [{ isOfficial: 'desc' }, { fromIngredient: 'asc' }],
  });
}
