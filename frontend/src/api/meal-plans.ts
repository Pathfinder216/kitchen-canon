import { apiGet, apiPatch, apiPost } from './client';
import type {
  CookingTimeline,
  CreateMealPlanInput,
  GroceryItem,
  MealPlanDetail,
  MealPlanSuggestion,
  MealPlanSummary,
  SuggestionFilters,
  UpdateMealPlanInput,
} from '../types/meal-plan';

export async function fetchMealPlans(): Promise<MealPlanSummary[]> {
  return apiGet<MealPlanSummary[]>('/meal-plans');
}

export async function fetchMealPlan(id: string): Promise<MealPlanDetail> {
  return apiGet<MealPlanDetail>(`/meal-plans/${id}`);
}

export async function createMealPlan(input: CreateMealPlanInput): Promise<MealPlanDetail> {
  return apiPost<MealPlanDetail>('/meal-plans', input);
}

export async function updateMealPlan(id: string, input: UpdateMealPlanInput): Promise<MealPlanDetail> {
  return apiPatch<MealPlanDetail>(`/meal-plans/${id}`, input);
}

export async function toggleGroceryItem(
  mealPlanId: string,
  itemId: string,
  purchased: boolean,
): Promise<GroceryItem> {
  return apiPatch<GroceryItem>(`/meal-plans/${mealPlanId}/grocery/${itemId}`, { purchased });
}

export async function remakeMealPlan(id: string): Promise<MealPlanDetail> {
  return apiPost<MealPlanDetail>(`/meal-plans/${id}/remake`, {});
}

/** Cooking schedule that ends at `serveAt` (an ISO date-time). */
export async function fetchMealPlanTimeline(id: string, serveAt: string): Promise<CookingTimeline> {
  return apiGet<CookingTimeline>(`/meal-plans/${id}/timeline?serveAt=${encodeURIComponent(serveAt)}`);
}

export async function recalculateMealPlanDietaryInfo(id: string): Promise<MealPlanDetail> {
  return apiPost<MealPlanDetail>(`/meal-plans/${id}/recalculate`, {});
}

/** Recipes that complement the given selection (empty when the user has fewer than 5 recipes). */
export async function fetchMealPlanSuggestions(
  recipeIds: string[],
  filters: SuggestionFilters = {},
): Promise<MealPlanSuggestion[]> {
  const params = new URLSearchParams();
  if (recipeIds.length > 0) params.set('recipeIds', recipeIds.join(','));
  if (filters.diets) params.set('diets', filters.diets);
  if (filters.freeFrom) params.set('freeFrom', filters.freeFrom);
  const qs = params.toString();
  return apiGet<MealPlanSuggestion[]>(`/meal-plans/suggestions${qs ? `?${qs}` : ''}`);
}
