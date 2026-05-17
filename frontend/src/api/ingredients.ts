import { apiGet, apiPost, apiPatch } from './client';

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
