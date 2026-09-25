import { z } from 'zod';

/**
 * Per-100 g nutrient keys stored on `IngredientCatalog.nutrition.per100g`.
 * Units: `calories` kcal, `sodium` mg, everything else grams.
 */
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

export const NUTRITION_SOURCES = ['fdc', 'manual', 'copied'] as const;
export type NutritionSource = (typeof NUTRITION_SOURCES)[number];

const amount = z.number().finite().min(0).max(100_000);

/** Every nutrient is optional — a partial label (e.g. calories only) is still useful. */
export const per100gSchema = z
  .object({
    calories: amount.optional(),
    protein: amount.optional(),
    fat: amount.optional(),
    saturatedFat: amount.optional(),
    carbs: amount.optional(),
    fiber: amount.optional(),
    sugar: amount.optional(),
    sodium: amount.optional(),
  } satisfies Record<NutrientKey, z.ZodType>)
  .strict();

/** Unit → grams for one of that unit (from FDC `foodPortions`), e.g. `{ cup: 244, tbsp: 15 }`. */
export const gramsPerUnitSchema = z
  .record(z.string().trim().toLowerCase().min(1).max(40), z.number().finite().positive().max(100_000))
  .refine((r) => Object.keys(r).length <= 30, 'At most 30 units');

/** The storage shape of `IngredientCatalog.nutrition` — also the write shape accepted by the API. */
export const nutritionSchema = z
  .object({
    per100g: per100gSchema,
    gramsPerUnit: gramsPerUnitSchema.optional(),
    source: z.enum(NUTRITION_SOURCES),
    /** FoodData Central food id this data came from (kept when copied from an FDC-sourced entry). */
    fdcId: z.number().int().positive().optional(),
    /** FDC's description of that food, shown so the user knows what was matched. */
    fdcDescription: z.string().trim().max(200).optional(),
  })
  .strict();

export type NutritionData = z.infer<typeof nutritionSchema>;
export type Per100g = z.infer<typeof per100gSchema>;
