import { apiGet, apiPost, apiPatch, apiDelete } from './client';

export interface CatalogAlias {
  id: string;
  alias: string;
}

export interface CatalogEntry {
  id: string;
  displayAlias: string;
  allergens: string[];
  diets: string[];
  isUserAdded: boolean;
  /** null = built-in global entry; otherwise the owning user's id. */
  userId: string | null;
  aliases: CatalogAlias[];
}

export function fetchIngredients(q?: string): Promise<CatalogEntry[]> {
  return apiGet<CatalogEntry[]>('/ingredients', q ? { q } : undefined);
}

export function createIngredientEntry(data: { name: string; allergens: string[]; diets: string[] }): Promise<CatalogEntry> {
  return apiPost<CatalogEntry>('/ingredients', data);
}

export function updateIngredientEntry(id: string, data: { allergens: string[]; diets: string[] }): Promise<CatalogEntry> {
  return apiPatch<CatalogEntry>(`/ingredients/${id}`, data);
}

export function deleteIngredientEntry(id: string): Promise<void> {
  return apiDelete(`/ingredients/${id}`);
}
