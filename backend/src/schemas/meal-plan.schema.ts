import { z } from 'zod';

const substitutionsSchema = z.record(
  z.string(),
  z.object({
    toIngredient: z.string(),
    ratio: z.number().positive(),
  }),
).optional();

const recipeInputSchema = z.object({
  recipeId: z.string(),
  servings: z.number().int().positive(),
  orderIndex: z.number().int().min(0).optional(),
  substitutions: substitutionsSchema,
});

export const createMealPlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  notes: z.string().optional(),
  recipes: z.array(recipeInputSchema).min(1),
});

export const updateMealPlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  date: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  recipes: z.array(recipeInputSchema).min(1).optional(),
});

export const updateGroceryItemSchema = z.object({
  purchased: z.boolean(),
});

export const timelineQuerySchema = z.object({
  // Any parseable date-time; past values are allowed so a plan can be previewed after the fact.
  serveAt: z
    .string()
    .min(1)
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'serveAt must be a valid date-time' })
    .transform((s) => new Date(s)),
});

/** Comma-separated list → trimmed, non-empty strings (missing/empty → []). */
const csvList = z
  .string()
  .optional()
  .transform((s) => (s ? s.split(',').map((v) => v.trim()).filter(Boolean) : []));

export const suggestionsQuerySchema = z.object({
  recipeIds: csvList.refine((ids) => ids.length <= 50, { message: 'Too many recipeIds (max 50)' }),
  diets: csvList,
  freeFrom: csvList,
});

export type CreateMealPlanInput = z.infer<typeof createMealPlanSchema>;
export type UpdateMealPlanInput = z.infer<typeof updateMealPlanSchema>;
