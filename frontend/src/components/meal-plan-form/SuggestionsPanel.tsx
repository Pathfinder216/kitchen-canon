import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchMealPlanSuggestions } from '../../api/meal-plans';
import type { MealPlanSuggestion, SuggestionFilters } from '../../types/meal-plan';

/** How many suggestion cards to show (the endpoint returns up to 6). */
const VISIBLE_SUGGESTIONS = 3;
/** Debounce so rapid add/remove clicks settle into one request. */
export const SUGGESTIONS_DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

interface SuggestionsPanelProps {
  selectedIds: string[];
  filters: SuggestionFilters;
  onAdd: (recipe: MealPlanSuggestion['recipe']) => void;
}

/**
 * "Goes well with this meal": recipes that complement the current selection, each with the
 * reasons it was picked and a one-tap Add. Renders nothing when there's nothing to suggest (the
 * server returns [] for users with fewer than 5 recipes).
 */
export function SuggestionsPanel({ selectedIds, filters, onAdd }: SuggestionsPanelProps) {
  const sortedIds = [...selectedIds].sort().join(',');
  const key = useDebouncedValue(`${sortedIds}|${filters.diets ?? ''}|${filters.freeFrom ?? ''}`, SUGGESTIONS_DEBOUNCE_MS);
  const [idsPart, diets, freeFrom] = key.split('|');
  const ids = idsPart ? idsPart.split(',') : [];

  const { data } = useQuery({
    queryKey: ['suggestions', ids, diets, freeFrom],
    queryFn: () => fetchMealPlanSuggestions(ids, { diets: diets || undefined, freeFrom: freeFrom || undefined }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // Hide anything already in the meal immediately, before the debounced refetch lands.
  const selected = new Set(selectedIds);
  const visible = (data ?? []).filter((s) => !selected.has(s.recipe.id)).slice(0, VISIBLE_SUGGESTIONS);
  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="suggestions-heading">
      <h2 id="suggestions-heading" className="text-sm font-semibold text-gray-700 mb-2">
        {selectedIds.length > 0 ? 'Goes well with this meal' : 'Ideas to start with'}
      </h2>
      <ul className="space-y-2">
        {visible.map((s) => (
          <li
            key={s.recipe.id}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-start gap-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{s.recipe.title}</p>
              {s.reasons.length > 0 && (
                <ul className="flex flex-wrap gap-1 mt-1" aria-label={`Why ${s.recipe.title}`}>
                  {s.reasons.map((reason) => (
                    <li key={reason} className="text-xs bg-green-50 text-green-700 rounded-full px-2 py-0.5">
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => onAdd(s.recipe)}
              className="shrink-0 text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-full px-3 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
              aria-label={`Add ${s.recipe.title} to meal`}
            >
              + Add
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
