import { apiGet } from './client';

/** Per-100 g nutrient keys stored on a catalog entry (mirrors backend `schemas/nutrition.schema.ts`). */
export const NUTRIENT_KEYS = [
  'calories',
  'protein',
  'fat',
  'saturatedFat',
  'carbs',
  'fiber',
  'sugar',
  'sodium',
] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

export const NUTRIENT_LABELS: Record<NutrientKey, { label: string; unit: string }> = {
  calories: { label: 'Calories', unit: 'kcal' },
  protein: { label: 'Protein', unit: 'g' },
  fat: { label: 'Fat', unit: 'g' },
  saturatedFat: { label: 'Saturated fat', unit: 'g' },
  carbs: { label: 'Carbs', unit: 'g' },
  fiber: { label: 'Fiber', unit: 'g' },
  sugar: { label: 'Sugar', unit: 'g' },
  sodium: { label: 'Sodium', unit: 'mg' },
};

export type NutritionSource = 'fdc' | 'manual' | 'copied';

/** `IngredientCatalog.nutrition` — values per 100 g (kcal / g / mg for sodium). */
export interface Nutrition {
  per100g: Partial<Record<NutrientKey, number>>;
  /** Grams in one of each unit, from USDA portions, e.g. `{ cup: 244, tbsp: 15 }`. */
  gramsPerUnit?: Record<string, number>;
  source: NutritionSource;
  fdcId?: number;
  /** USDA's name for the matched food. */
  fdcDescription?: string;
}

/** One USDA FoodData Central match, normalized by the backend proxy. */
export interface FdcMatch {
  fdcId: number;
  description: string;
  dataType: string | null;
  foodCategory: string | null;
  nutrition: Nutrition;
}

/** Whether the server has an FDC_API_KEY; the lookup button is hidden when it doesn't. */
export function fetchNutritionStatus(): Promise<{ lookupConfigured: boolean }> {
  return apiGet<{ lookupConfigured: boolean }>('/nutrition/status');
}

/** Top USDA matches for a food name (per-100 g values, no portions). */
export function searchNutrition(q: string): Promise<FdcMatch[]> {
  return apiGet<FdcMatch[]>('/nutrition/search', { q });
}

/** One USDA food including its portions (`gramsPerUnit`). */
export function fetchFdcFood(fdcId: number): Promise<FdcMatch> {
  return apiGet<FdcMatch>(`/nutrition/food/${fdcId}`);
}
