import type { IngredientFormItem, StepFormItem } from './useRecipeFormState';
import { computeRemainingPercents } from '../../utils/resolveIngredientRefs';

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

/**
 * Sum the referenced percentage for every ingredient key across all steps. A bare
 * `{key}` counts as whatever remained at that point (see computeRemainingPercents).
 */
export function getRefUsage(steps: StepFormItem[]): Record<string, number> {
  const refUsage: Record<string, number> = {};
  for (const refs of computeRemainingPercents(steps.map((s) => s.instruction))) {
    for (const { key, pct } of refs) refUsage[key] = (refUsage[key] ?? 0) + pct;
  }
  // Round away float noise so e.g. 0.1 + 64.1 + 35.8 compares (and displays) as exactly 100.
  for (const key of Object.keys(refUsage)) refUsage[key] = Math.round(refUsage[key] * 1e6) / 1e6;
  return refUsage;
}

/** Keys with a bare `{key}` reference that resolves to 0% because earlier references used it all up. */
function getExhaustedBareRefKeys(steps: StepFormItem[]): Set<string> {
  const keys = new Set<string>();
  for (const refs of computeRemainingPercents(steps.map((s) => s.instruction))) {
    for (const { key, pct, bare } of refs) if (bare && pct === 0) keys.add(key);
  }
  return keys;
}

export function getOverReferencedIngredients(steps: StepFormItem[]): string[] {
  const usage = getRefUsage(steps);
  const exhausted = getExhaustedBareRefKeys(steps);
  return Object.entries(usage)
    .filter(([key, pct]) => pct > 100 || exhausted.has(key))
    .map(([key, pct]) => (pct > 100 ? `${key} (${pct}%)` : `${key} (a bare {${key}} has nothing left)`));
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
