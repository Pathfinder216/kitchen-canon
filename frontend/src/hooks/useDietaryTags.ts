import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api/client';

export interface DietaryTags {
  allergens: string[];
  diets: string[];
  allergenLabels: Record<string, string>;
  dietLabels: Record<string, string>;
}

const EMPTY: DietaryTags = { allergens: [], diets: [], allergenLabels: {}, dietLabels: {} };

// The dietary vocabulary (allergens, diets, labels) served from GET /api/meta — the single
// source of truth, owned by the backend. While the (cache-forever) query is in flight we return
// empty structures; the tag chips are sub-second-empty only on a cold first load, and the
// service worker caches /api/meta for offline use thereafter.
export function useDietaryTags(): DietaryTags {
  const { data } = useQuery({
    queryKey: ['meta'],
    queryFn: () => apiGet<DietaryTags>('/meta'),
    staleTime: Infinity,
  });
  return data ?? EMPTY;
}
