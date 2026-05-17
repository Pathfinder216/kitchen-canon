import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchIngredients, createIngredientEntry, updateIngredientEntry } from '../api/ingredients';
import { INGREDIENT_SUGGESTIONS } from '../constants/suggestions';

// Returns every alias string as a flat sorted list for ComboInput suggestions and catalog presence checks.
// Falls back to the static list while loading so there's no UI flicker.
export function useIngredientNames(): string[] {
  const { data } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => fetchIngredients(),
    staleTime: 5 * 60 * 1000,
  });
  if (!data) return INGREDIENT_SUGGESTIONS;
  const all = data.flatMap((e) => e.aliases.map((a) => a.alias));
  return all.length > 0 ? all : INGREDIENT_SUGGESTIONS;
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
