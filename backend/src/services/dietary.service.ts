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

async function findCatalogEntry(name: string) {
  const lower = name.toLowerCase().trim();
  const match = await prisma.ingredientAlias.findUnique({
    where: { alias: lower },
    include: { catalog: true },
  });
  return match?.catalog ?? null;
}

export async function computeDietaryInfo(ingredients: IngredientInput[]): Promise<DietaryInfo> {
  const nonOptional = ingredients.filter((i) => !i.isOptional);
  const allergenSet = new Set<string>();
  let compatibleDiets = new Set<string>(DIETS);
  const unknownIngredients: string[] = [];
  let hasAnyUnknown = false;

  for (const ing of nonOptional) {
    const entry = await findCatalogEntry(ing.name);
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

export async function updateRecipeDietaryLabels(
  recipeId: string,
  ingredients: IngredientInput[],
): Promise<void> {
  const info = await computeDietaryInfo(ingredients);

  const labelIds: string[] = [];
  for (const allergen of info.allergens) {
    const label = await prisma.label.upsert({
      where: { type_name: { type: 'allergen', name: allergen } },
      update: {},
      create: { type: 'allergen', name: allergen },
    });
    labelIds.push(label.id);
  }
  for (const diet of info.diets) {
    const label = await prisma.label.upsert({
      where: { type_name: { type: 'dietary', name: diet } },
      update: {},
      create: { type: 'dietary', name: diet },
    });
    labelIds.push(label.id);
  }

  const autoLabelIds = (await prisma.label.findMany({ where: { type: { in: ['dietary', 'allergen'] } }, select: { id: true } })).map((l) => l.id);
  await prisma.$transaction([
    prisma.recipeLabel.deleteMany({ where: { recipeId, labelId: { in: autoLabelIds } } }),
    ...labelIds.map((labelId) =>
      prisma.recipeLabel.create({ data: { recipeId, labelId } }),
    ),
  ]);
}
