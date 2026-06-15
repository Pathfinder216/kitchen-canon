import type { ActiveSwaps } from '../../types/meal-plan';

export interface SelectedRecipe {
  recipeId: string;
  title: string;
  defaultServings: number;
  servings: number;
  activeSwaps: ActiveSwaps;
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
