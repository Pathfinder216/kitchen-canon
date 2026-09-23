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
  /** Grocery aisle key (see GET /api/meta `aisles`); null = unassigned. */
  aisle: string | null;
  isUserAdded: boolean;
  /** null = built-in global entry; otherwise the owning user's id. */
  userId: string | null;
  aliases: CatalogAlias[];
}

export function fetchIngredients(q?: string): Promise<CatalogEntry[]> {
  return apiGet<CatalogEntry[]>('/ingredients', q ? { q } : undefined);
}

export function createIngredientEntry(data: { name: string; allergens: string[]; diets: string[]; aisle?: string | null }): Promise<CatalogEntry> {
  return apiPost<CatalogEntry>('/ingredients', data);
}

export function updateIngredientEntry(id: string, data: { allergens: string[]; diets: string[]; aisle?: string | null }): Promise<CatalogEntry> {
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
