import type { ActiveSwaps } from '../../types/meal-plan';

export interface SelectedRecipe {
  recipeId: string;
  title: string;
  defaultServings: number;
  /** Empty-able string so the field can be cleared mid-edit; parsed on submit via `parseServings`. */
  servings: string;
  activeSwaps: ActiveSwaps;
}

/** Parse an empty-able servings string to a valid Int ≥ 1, falling back to the recipe default. */
export function parseServings(value: string, fallback: number): number {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

export interface MediaItem {
  id: string;
  type: string;
  path: string;
}

/** Cover-photo lookup uses a raw fetch (full /api path, no JSON content-type needed for GET). */
export async function fetchCoverPhoto(recipeId: string): Promise<MediaItem | null> {
  const res = await fetch(`/api/recipes/${recipeId}/media`);
  if (!res.ok) return null;
  const items: MediaItem[] = await res.json();
  return items.find((m) => m.type === 'image') ?? null;
}
