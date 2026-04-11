import { apiGet, apiPost, apiDelete } from './client';

export interface Substitution {
  id: string;
  fromIngredient: string;
  toIngredient: string;
  ratio: number;
  notes: string | null;
  isOfficial: boolean;
}

export interface CreateSubstitutionInput {
  fromIngredient: string;
  toIngredient: string;
  ratio: number;
  notes?: string;
}

export async function fetchSubstitutions(from?: string): Promise<Substitution[]> {
  const query = from ? `?from=${encodeURIComponent(from)}` : '';
  return apiGet<Substitution[]>(`/substitutions${query}`);
}

export async function fetchSubstitutionsForRecipe(recipeId: string): Promise<Substitution[]> {
  return apiGet<Substitution[]>(`/recipes/${recipeId}/substitutions`);
}

export async function createSubstitution(input: CreateSubstitutionInput): Promise<Substitution> {
  return apiPost<Substitution>('/substitutions', input);
}

export async function deleteSubstitution(id: string): Promise<void> {
  return apiDelete(`/substitutions/${id}`);
}
