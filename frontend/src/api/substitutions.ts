import { apiGet } from './client';

export interface Substitution {
  id: string;
  fromIngredient: string;
  toIngredient: string;
  ratio: number;
  notes: string | null;
  isOfficial: boolean;
}

export async function fetchSubstitutionsForRecipe(recipeId: string): Promise<Substitution[]> {
  return apiGet<Substitution[]>(`/recipes/${recipeId}/substitutions`);
}
