import { apiGet, apiPatch, apiPost } from './client';
import type { CreateMealPlanInput, GroceryItem, MealPlanDetail, MealPlanSummary, UpdateMealPlanInput } from '../types/meal-plan';

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

export async function recalculateMealPlanDietaryInfo(id: string): Promise<MealPlanDetail> {
  return apiPost<MealPlanDetail>(`/meal-plans/${id}/recalculate`, {});
}
