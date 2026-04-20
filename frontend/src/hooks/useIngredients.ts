import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchIngredients, createIngredientEntry, updateIngredientEntry } from '../api/ingredients';
import { INGREDIENT_SUGGESTIONS } from '../constants/suggestions';

// Returns catalog names as a sorted string[] for ComboInput suggestions.
// Falls back to the static list while loading so there's no UI flicker.
export function useIngredientNames(): string[] {
  const { data } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => fetchIngredients(),
    staleTime: 5 * 60 * 1000,
    placeholderData: INGREDIENT_SUGGESTIONS.map((name) => ({ id: '', name, allergens: [], diets: [], isUserAdded: false })),
  });
  return data?.map((e) => e.name) ?? INGREDIENT_SUGGESTIONS;
}

export function useCreateIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createIngredientEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ingredients'] }),
  });
}

export function useUpdateIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { allergens: string[]; diets: string[] } }) =>
      updateIngredientEntry(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ingredients'] }),
  });
}
