import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type { Nutrition } from './nutrition';

export interface CatalogAlias {
  id: string;
  alias: string;
}

export interface CatalogEntry {
  id: string;
  displayAlias: string;
  allergens: string[];
  diets: string[];
  /** Grocery aisle key (see GET /api/meta `aisles`); null = unassigned. */
  aisle: string | null;
  /** Per-100 g nutrition captured at classification time; null = none recorded. */
  nutrition: Nutrition | null;
  isUserAdded: boolean;
  /** null = built-in global entry; otherwise the owning user's id. */
  userId: string | null;
  aliases: CatalogAlias[];
}

export function fetchIngredients(q?: string): Promise<CatalogEntry[]> {
  return apiGet<CatalogEntry[]>('/ingredients', q ? { q } : undefined);
}

/** A "Did you mean …?" catalog match for an unknown ingredient name (GET /api/ingredients/suggest). */
export interface IngredientSuggestion {
  id: string;
  displayAlias: string;
  allergens: string[];
  diets: string[];
  aisle: string | null;
  nutrition: Nutrition | null;
  /** Fuzzy similarity in [0, 1]; suggestions arrive best-first. */
  score: number;
}

/** Top-3 fuzzy catalog matches for a name. Suggestions only — nothing is saved until the user confirms. */
export function suggestIngredients(name: string): Promise<IngredientSuggestion[]> {
  return apiGet<IngredientSuggestion[]>('/ingredients/suggest', { name });
}

/** Omitted `aisle`/`nutrition` keep the current value (a new shadow inherits the built-in's); null clears. */
export interface CatalogWriteFields {
  allergens: string[];
  diets: string[];
  aisle?: string | null;
  nutrition?: Nutrition | null;
}

export function createIngredientEntry(data: CatalogWriteFields & { name: string }): Promise<CatalogEntry> {
  return apiPost<CatalogEntry>('/ingredients', data);
}

export function updateIngredientEntry(id: string, data: CatalogWriteFields): Promise<CatalogEntry> {
  return apiPatch<CatalogEntry>(`/ingredients/${id}`, data);
}

export function deleteIngredientEntry(id: string): Promise<void> {
  return apiDelete(`/ingredients/${id}`);
}

/**
 * Reassign an ingredient name to a grocery aisle for this user only, via the private-shadow
 * mechanism: POST the name with the chosen aisle, preserving the dietary tags of whatever entry the
 * name currently resolves to (the user's own first, then the built-in) so only the aisle changes.
 */
export async function setIngredientAisle(name: string, aisle: string): Promise<CatalogEntry> {
  const lower = name.toLowerCase().trim();
  const candidates = (await fetchIngredients(lower)).filter(
    (e) => e.displayAlias === lower || e.aliases.some((a) => a.alias === lower),
  );
  const current = candidates.find((e) => e.userId !== null) ?? candidates[0];
  return createIngredientEntry({
    name: lower,
    allergens: current?.allergens ?? [],
    diets: current?.diets ?? [],
    aisle,
  });
}
