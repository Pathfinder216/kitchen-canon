import { z } from 'zod';

const ingredientSchema = z.object({
  name: z.string().min(1),
  originalName: z.string().optional(),
  amount: z.number().positive().optional(),
  unit: z.string().optional(),
  isOptional: z.boolean().default(false),
  orderIndex: z.number().int().min(0),
  internalId: z.string().min(1),
});

const stepSchema = z.object({
  orderIndex: z.number().int().min(0),
  instruction: z.string().min(1),
  timeMinutes: z.number().min(0).optional(),
  isActiveTime: z.boolean().default(true),
});

export const createRecipeSchema = z.object({
  title: z.string().min(1).max(500),
  servings: z.number().int().positive().default(1),
  source: z.string().max(2000).optional(),
  authorNotes: z.string().optional(),
  personalNotes: z.string().optional(),
  ingredients: z.array(ingredientSchema).default([]),
  steps: z.array(stepSchema).default([]),
});

export const updateRecipeSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  servings: z.number().int().positive().optional(),
  source: z.string().max(2000).nullable().optional(),
  authorNotes: z.string().nullable().optional(),
  personalNotes: z.string().nullable().optional(),
  ingredients: z.array(ingredientSchema).optional(),
  steps: z.array(stepSchema).optional(),
});

export const recipeQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  archived: z.enum(['true', 'false']).default('false'),
  includeIngredients: z.string().optional(), // comma-separated
  excludeIngredients: z.string().optional(), // comma-separated
  labels: z.string().optional(), // comma-separated label names
  courses: z.string().optional(), // comma-separated course names
});

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;
export type RecipeQueryInput = z.infer<typeof recipeQuerySchema>;
