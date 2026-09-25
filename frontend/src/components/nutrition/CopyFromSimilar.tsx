import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchIngredients, type CatalogEntry, type IngredientSuggestion } from '../../api/ingredients';
import type { Nutrition } from '../../api/nutrition';
import { ComboInput } from '../ComboInput';
import { IngredientSuggestions } from '../IngredientSuggestions';

/** The fields "copy from similar" prefills — both catalog entries and suggestions carry them. */
export interface CopySource {
  id: string;
  displayAlias: string;
  allergens: string[];
  diets: string[];
  aisle: string | null;
  nutrition: Nutrition | null;
}

interface Props {
  /** The ingredient being classified; its fuzzy "Did you mean" matches are offered first. */
  name: string;
  /** Id of the entry last copied from, highlighted among the suggestions. */
  selectedId?: string | null;
  /** Catalog ids that must not be offered (e.g. the entry being edited). */
  excludeIds?: string[];
  onPick: (source: CopySource) => void;
}

/**
 * "Copy from a similar ingredient": the top fuzzy matches as one-tap chips, plus a ComboInput
 * over the whole visible catalog. Picking prefills tags, aisle and nutrition — the caller keeps
 * everything editable and saves only when the user confirms.
 */
export function CopyFromSimilar({ name, selectedId, excludeIds = [], onPick }: Props) {
  const [text, setText] = useState('');
  const inputId = useId();
  const { data: entries = [] } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => fetchIngredients(),
    staleTime: 5 * 60 * 1000,
  });

  // Where the user's own entry shadows a built-in of the same name, only theirs is offered.
  const ownNames = new Set(entries.filter((e) => e.userId !== null).map((e) => e.displayAlias));
  const candidates = entries.filter(
    (e) => !excludeIds.includes(e.id) && (e.userId !== null || !ownNames.has(e.displayAlias)),
  );
  const byName = new Map<string, CatalogEntry>(candidates.map((e) => [e.displayAlias, e]));

  function pickByName(value: string) {
    const entry = byName.get(value.toLowerCase().trim());
    if (entry) {
      onPick(entry);
      setText('');
    }
  }

  return (
    <div className="space-y-1.5">
      <IngredientSuggestions
        name={name}
        selectedId={selectedId}
        excludeIds={excludeIds}
        onPick={(s: IngredientSuggestion) => onPick(s)}
      />
      {candidates.length > 0 && (
        <div className="flex items-center gap-1.5">
          <label htmlFor={inputId} className="text-xs text-gray-500 shrink-0">Copy from</label>
          <ComboInput
            id={inputId}
            value={text}
            onChange={setText}
            onSubmit={pickByName}
            suggestions={[...byName.keys()]}
            placeholder="a similar ingredient…"
            wrapperClassName="flex-1 min-w-0"
            className="rounded-md border border-gray-300 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      )}
    </div>
  );
}
