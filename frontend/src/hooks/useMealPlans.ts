import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMealPlan,
  fetchMealPlan,
  fetchMealPlans,
  toggleGroceryItem,
  updateMealPlan,
} from '../api/meal-plans';
import type { CreateMealPlanInput, UpdateMealPlanInput } from '../types/meal-plan';

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

export function useUpdateMealPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateMealPlanInput) =>
      updateMealPlan(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] });
      queryClient.invalidateQueries({ queryKey: ['meal-plans', id] });
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
