interface IngredientEntry {
  name: string;
  amount: number | null;
  unit: string | null;
}

interface GroceryEntry {
  ingredient: string;
  amount: number | null;
  unit: string | null;
}

export function consolidateIngredients(
  recipes: Array<{ ingredients: IngredientEntry[]; servingsMultiplier: number }>,
): GroceryEntry[] {
  const consolidated = new Map<string, { amount: number | null; unit: string | null }>();

  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const key = `${ing.name.toLowerCase()}|${(ing.unit || '').toLowerCase()}`;
      const existing = consolidated.get(key);

      const scaledAmount = ing.amount !== null ? ing.amount * recipe.servingsMultiplier : null;

      if (existing) {
        if (existing.amount !== null && scaledAmount !== null) {
          existing.amount += scaledAmount;
        } else if (scaledAmount !== null) {
          existing.amount = scaledAmount;
        }
      } else {
        consolidated.set(key, {
          amount: scaledAmount,
          unit: ing.unit || null,
        });
      }
    }
  }

  return Array.from(consolidated.entries()).map(([key, value]) => ({
    ingredient: key.split('|')[0],
    amount: value.amount,
    unit: value.unit,
  }));
}
