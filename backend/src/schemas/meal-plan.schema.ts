import { z } from 'zod';

const substitutionsSchema = z.record(
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

export type CreateMealPlanInput = z.infer<typeof createMealPlanSchema>;
export type UpdateMealPlanInput = z.infer<typeof updateMealPlanSchema>;
