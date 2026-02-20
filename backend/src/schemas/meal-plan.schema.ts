import { z } from 'zod';

export const createMealPlanSchema = z.object({
  name: z.string().max(200).optional(),
  recipes: z.array(
    z.object({
      recipeId: z.string(),
      servings: z.number().int().positive(),
      orderIndex: z.number().int().min(0).optional(),
    }),
  ).min(1),
});

export const updateGroceryItemSchema = z.object({
  purchased: z.boolean(),
});

export type CreateMealPlanInput = z.infer<typeof createMealPlanSchema>;
