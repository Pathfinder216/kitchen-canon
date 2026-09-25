import { NUTRIENT_KEYS, type NutrientKey, type Nutrition, type NutritionSource } from '../api/nutrition';

/**
 * Editable form state for a catalog entry's nutrition. Values are strings so number inputs can be
 * cleared (see 00-conventions: parse on submit, never bind a number input to numeric state).
 */
export interface NutritionDraft {
  values: Record<NutrientKey, string>;
  gramsPerUnit?: Record<string, number>;
  source: NutritionSource;
  fdcId?: number;
  fdcDescription?: string;
}

function emptyValues(): Record<NutrientKey, string> {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, ''])) as Record<NutrientKey, string>;
}

export function emptyNutritionDraft(): NutritionDraft {
  return { values: emptyValues(), source: 'manual' };
}

export function nutritionToDraft(n: Nutrition | null | undefined, source?: NutritionSource): NutritionDraft {
  if (!n) return emptyNutritionDraft();
  const values = emptyValues();
  for (const k of NUTRIENT_KEYS) {
    const v = n.per100g[k];
    if (typeof v === 'number') values[k] = String(v);
  }
  return {
    values,
    ...(n.gramsPerUnit && { gramsPerUnit: n.gramsPerUnit }),
    source: source ?? n.source,
    ...(n.fdcId !== undefined && { fdcId: n.fdcId }),
    ...(n.fdcDescription && { fdcDescription: n.fdcDescription }),
  };
}

/** Parse a draft for saving. Blank/invalid fields are omitted; an entirely empty draft is `null`. */
export function draftToNutrition(d: NutritionDraft): Nutrition | null {
  const per100g: Nutrition['per100g'] = {};
  for (const k of NUTRIENT_KEYS) {
    const raw = d.values[k].trim();
    if (raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) per100g[k] = n;
  }
  const hasPortions = !!d.gramsPerUnit && Object.keys(d.gramsPerUnit).length > 0;
  if (Object.keys(per100g).length === 0 && !hasPortions) return null;
  return {
    per100g,
    ...(hasPortions && { gramsPerUnit: d.gramsPerUnit }),
    source: d.source,
    ...(d.fdcId !== undefined && { fdcId: d.fdcId }),
    ...(d.fdcDescription && { fdcDescription: d.fdcDescription }),
  };
}

/** Short one-line summary, e.g. "61 kcal · 3.2 g protein / 100 g". */
export function nutritionSummary(n: Nutrition | null | undefined): string | null {
  if (!n) return null;
  const parts: string[] = [];
  if (n.per100g.calories !== undefined) parts.push(`${Math.round(n.per100g.calories)} kcal`);
  if (n.per100g.protein !== undefined) parts.push(`${Math.round(n.per100g.protein * 10) / 10} g protein`);
  return parts.length > 0 ? `${parts.join(' · ')} / 100 g` : 'nutrition recorded';
}
