import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type {
  Recipe,
  PaginatedResponse,
  CreateRecipeInput,
  UpdateRecipeInput,
  RecipeListParams,
} from '../types/recipe';

export function fetchRecipes(params?: RecipeListParams): Promise<PaginatedResponse<Recipe>> {
  return apiGet<PaginatedResponse<Recipe>>('/recipes', params as Record<string, string | number | boolean | undefined>);
}

export function fetchRecipe(id: string): Promise<Recipe> {
  return apiGet<Recipe>(`/recipes/${id}`);
}

export function createRecipe(input: CreateRecipeInput): Promise<Recipe> {
  return apiPost<Recipe>('/recipes', input);
}

export function updateRecipe(id: string, input: UpdateRecipeInput): Promise<Recipe> {
  return apiPatch<Recipe>(`/recipes/${id}`, input);
}

export function archiveRecipe(id: string): Promise<Recipe> {
  return apiDelete<Recipe>(`/recipes/${id}`);
}

export function fetchRecipeVersions(id: string): Promise<Recipe[]> {
  return apiGet<Recipe[]>(`/recipes/${id}/versions`);
}

export function restoreRecipeVersion(id: string, version: number): Promise<Recipe> {
  return apiPost<Recipe>(`/recipes/${id}/restore/${version}`);
}
