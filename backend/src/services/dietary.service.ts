import { prisma } from '../db.js';
import { DIETS } from '../constants/dietaryTags.js';

interface IngredientInput {
  name: string;
  isOptional: boolean;
}

export interface DietaryInfo {
  allergens: string[];
  diets: string[];
  unknownIngredients: string[];
}

async function findCatalogEntry(name: string, userId: string) {
  const lower = name.toLowerCase().trim();
  // Consider global (userId null) and the user's own private aliases, preferring the user's own.
  const matches = await prisma.ingredientAlias.findMany({
    where: { alias: lower, OR: [{ userId: null }, { userId }] },
    include: { catalog: true },
  });
  if (matches.length === 0) return null;
  const own = matches.find((m) => m.userId === userId);
  return (own ?? matches[0]).catalog ?? null;
}

export async function computeDietaryInfo(
  ingredients: IngredientInput[],
  userId: string,
): Promise<DietaryInfo> {
  const nonOptional = ingredients.filter((i) => !i.isOptional);
  const allergenSet = new Set<string>();
  let compatibleDiets = new Set<string>(DIETS);
  const unknownIngredients: string[] = [];
  let hasAnyUnknown = false;

  for (const ing of nonOptional) {
    const entry = await findCatalogEntry(ing.name, userId);
    if (!entry) {
      unknownIngredients.push(ing.name);
      hasAnyUnknown = true;
      continue;
    }
    const allergens = entry.allergens as string[];
    const diets = entry.diets as string[];
    for (const a of allergens) allergenSet.add(a);
    for (const d of [...compatibleDiets]) {
      if (!diets.includes(d)) compatibleDiets.delete(d);
    }
  }

  if (hasAnyUnknown) compatibleDiets = new Set();

  return {
    allergens: [...allergenSet].sort(),
    diets: [...compatibleDiets].sort(),
    unknownIngredients: [...new Set(unknownIngredients)],
  };
}

/** Get-or-create a global (userId null) label. Null can't be used in a compound-unique where,
 *  so look it up explicitly then create. */
async function getOrCreateGlobalLabel(type: string, name: string): Promise<string> {
  const existing = await prisma.label.findFirst({ where: { type, name, userId: null } });
  if (existing) return existing.id;
  const created = await prisma.label.create({ data: { type, name } });
  return created.id;
}

export async function updateRecipeDietaryLabels(
  recipeId: string,
  ingredients: IngredientInput[],
  userId: string,
): Promise<void> {
  const info = await computeDietaryInfo(ingredients, userId);

  const labelIds: string[] = [];
  for (const allergen of info.allergens) {
    labelIds.push(await getOrCreateGlobalLabel('allergen', allergen));
  }
  for (const diet of info.diets) {
    labelIds.push(await getOrCreateGlobalLabel('dietary', diet));
  }

  const autoLabelIds = (await prisma.label.findMany({ where: { type: { in: ['dietary', 'allergen'] } }, select: { id: true } })).map((l) => l.id);
  await prisma.$transaction([
    prisma.recipeLabel.deleteMany({ where: { recipeId, labelId: { in: autoLabelIds } } }),
    ...labelIds.map((labelId) =>
      prisma.recipeLabel.create({ data: { recipeId, labelId } }),
    ),
  ]);
}
