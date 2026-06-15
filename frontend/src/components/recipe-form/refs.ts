import type { IngredientFormItem, StepFormItem } from './useRecipeFormState';

/**
 * The key used to reference an ingredient inside a step instruction. Duplicate
 * names get a 1-based rank suffix ("butter 2") so each occurrence is distinct.
 */
export function refKeyForIngredient(ingredients: IngredientFormItem[], ingIndex: number): string {
  const name = ingredients[ingIndex].name;
  const total = ingredients.filter((i) => i.name === name).length;
  if (total === 1) return name;
  let rank = 1;
  for (let i = 0; i < ingIndex; i++) {
    if (ingredients[i].name === name) rank++;
  }
  return `${name} ${rank}`;
}

const REF_PATTERN = /\{([^}:]+)(?::(\d+(?:\.\d+)?)%)?\}/g;

/** Sum the referenced percentage for every ingredient key across all steps. */
export function getRefUsage(steps: StepFormItem[]): Record<string, number> {
  const refUsage: Record<string, number> = {};
  for (const s of steps) {
    let m: RegExpExecArray | null;
    REF_PATTERN.lastIndex = 0;
    while ((m = REF_PATTERN.exec(s.instruction)) !== null) {
      refUsage[m[1]] = (refUsage[m[1]] ?? 0) + (m[2] !== undefined ? parseFloat(m[2]) : 100);
    }
  }
  return refUsage;
}

export function getOverReferencedIngredients(steps: StepFormItem[]): string[] {
  const usage = getRefUsage(steps);
  return Object.entries(usage).filter(([, pct]) => pct > 100).map(([key, pct]) => `${key} (${pct}%)`);
}

export function getUnderReferencedIngredients(ingredients: IngredientFormItem[], steps: StepFormItem[]): string[] {
  const usage = getRefUsage(steps);
  return ingredients
    .filter((ing) => ing.name)
    .map((_, i) => {
      const name = ingredients[i].name;
      const total = ingredients.filter((x) => x.name === name).length;
      let rank = 1;
      for (let j = 0; j < i; j++) if (ingredients[j].name === name) rank++;
      return total === 1 ? name : `${name} ${rank}`;
    })
    .filter((key, i, arr) => arr.indexOf(key) === i) // dedupe
    .filter((key) => (usage[key] ?? 0) < 100)
    .map((key) => {
      const pct = usage[key] ?? 0;
      return pct === 0 ? key : `${key} (${pct}%)`;
    });
}

export function getUnclassifiedIngredients(ingredients: IngredientFormItem[], catalogNameSet: Set<string>): string[] {
  return [...new Set(
    ingredients
      .filter((ing) => ing.name.trim() && !catalogNameSet.has(ing.name.toLowerCase().trim()))
      .map((ing) => ing.name),
  )];
}
