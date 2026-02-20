import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMealPlan,
  fetchMealPlan,
  fetchMealPlans,
  remakeMealPlan,
  toggleGroceryItem,
} from '../api/meal-plans';
import type { CreateMealPlanInput } from '../types/meal-plan';

export function useMealPlans() {
  return useQuery({
    queryKey: ['meal-plans'],
    queryFn: fetchMealPlans,
  });
}

export function useMealPlan(id: string) {
  return useQuery({
    queryKey: ['meal-plans', id],
    queryFn: () => fetchMealPlan(id),
    enabled: !!id,
  });
}

export function useCreateMealPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMealPlanInput) => createMealPlan(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] });
    },
  });
}

export function useToggleGroceryItem(mealPlanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, purchased }: { itemId: string; purchased: boolean }) =>
      toggleGroceryItem(mealPlanId, itemId, purchased),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans', mealPlanId] });
    },
  });
}

export function useRemakeMealPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => remakeMealPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] });
    },
  });
}
