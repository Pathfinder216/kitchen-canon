import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api/client';

export interface AisleVocabulary {
  /** Aisle keys in display/sort order; `household-other` ("Other") is last. */
  aisles: string[];
  aisleLabels: Record<string, string>;
}

export const OTHER_AISLE = 'household-other';

const EMPTY: AisleVocabulary = { aisles: [], aisleLabels: {} };

// The grocery aisle vocabulary, served alongside the dietary tags from GET /api/meta (the backend
// owns it — `constants/aisles.ts`). Shares the cache-forever ['meta'] query with useDietaryTags.
export function useAisles(): AisleVocabulary {
  const { data } = useQuery({
    queryKey: ['meta'],
    queryFn: () => apiGet<AisleVocabulary>('/meta'),
    staleTime: Infinity,
  });
  return data?.aisles ? { aisles: data.aisles, aisleLabels: data.aisleLabels ?? {} } : EMPTY;
}
