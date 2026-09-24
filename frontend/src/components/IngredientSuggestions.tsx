import { useQuery } from '@tanstack/react-query';
import { suggestIngredients, type IngredientSuggestion } from '../api/ingredients';

interface Props {
  /** The unclassified ingredient name to find near matches for. */
  name: string;
  /** Id of the suggestion the user last picked, highlighted as selected. */
  selectedId?: string | null;
  onPick: (suggestion: IngredientSuggestion) => void;
}

/**
 * "Did you mean …?" one-tap options for an unclassified ingredient: the top fuzzy catalog matches.
 * Picking one only prefills the classify form — the user still reviews and saves, so a fuzzy
 * guess never silently decides an ingredient's allergens.
 *
 * Keyed under ['ingredients', …] so saving a catalog entry (which invalidates ['ingredients'])
 * refreshes suggestions too.
 */
export function IngredientSuggestions({ name, selectedId, onPick }: Props) {
  const normalized = name.toLowerCase().trim();
  const { data } = useQuery({
    queryKey: ['ingredients', 'suggest', normalized],
    queryFn: () => suggestIngredients(normalized),
    enabled: normalized.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  if (!data || data.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-gray-500">Did you mean</span>
      {data.map((s) => {
        const selected = s.id === selectedId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s)}
            aria-pressed={selected}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              selected
                ? 'bg-amber-100 border-amber-400 text-amber-800'
                : 'border-amber-200 text-amber-700 hover:border-amber-300 bg-white'
            }`}
          >
            {s.displayAlias}
          </button>
        );
      })}
      <span className="text-xs text-gray-500">?</span>
    </div>
  );
}
