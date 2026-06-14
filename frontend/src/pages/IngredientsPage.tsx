import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchIngredients, updateIngredientEntry, deleteIngredientEntry, type CatalogEntry } from '../api/ingredients';
import { useDietaryTags } from '../hooks/useDietaryTags';

function EditRow({ entry, onDone }: { entry: CatalogEntry; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { allergens: ALLERGENS, diets: DIETS, allergenLabels: ALLERGEN_LABELS, dietLabels: DIET_LABELS } = useDietaryTags();
  const [allergens, setAllergens] = useState<string[]>(entry.allergens);
  const [diets, setDiets] = useState<string[]>(entry.diets);

  const mutation = useMutation({
    mutationFn: () => updateIngredientEntry(entry.id, { allergens, diets }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      onDone();
    },
  });

  function toggle(kind: 'allergens' | 'diets', tag: string) {
    if (kind === 'allergens') {
      setAllergens((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
    } else {
      setDiets((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
    }
  }

  return (
    <div className="px-4 py-3 bg-orange-50 border-t border-orange-100 space-y-3">
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">Allergens</p>
        <div className="flex flex-wrap gap-1.5">
          {ALLERGENS.map((a) => {
            const checked = allergens.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggle('allergens', a)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  checked
                    ? 'bg-red-100 border-red-300 text-red-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {ALLERGEN_LABELS[a]}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">Compatible diets</p>
        <div className="flex flex-wrap gap-1.5">
          {DIETS.map((d) => {
            const checked = diets.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggle('diets', d)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  checked
                    ? 'bg-green-100 border-green-300 text-green-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {DIET_LABELS[d]}
              </button>
            );
          })}
        </div>
      </div>
      {mutation.isError && <p className="text-xs text-red-600">Failed to save.</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="text-xs font-medium bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-md transition-colors"
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-xs font-medium text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  );
}

function IngredientRow({ entry, isEditing, onEdit, onDone }: {
  entry: CatalogEntry;
  isEditing: boolean;
  onEdit: () => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const { allergenLabels: ALLERGEN_LABELS, dietLabels: DIET_LABELS } = useDietaryTags();
  const deleteMutation = useMutation({
    mutationFn: () => deleteIngredientEntry(entry.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ingredients'] }),
  });
  // Show aliases that differ from the displayAlias (exclude stem variants — keep only meaningful synonyms)
  const synonyms = entry.aliases
    .map((a) => a.alias)
    .filter((a) => a !== entry.displayAlias && !a.startsWith(entry.displayAlias));

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3 pr-6">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{entry.displayAlias}</p>
          {synonyms.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{synonyms.join(' · ')}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-1">
            {entry.allergens.map((a) => (
              <span key={a} className="text-xs px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">
                {ALLERGEN_LABELS[a] ?? a}
              </span>
            ))}
            {entry.diets.map((d) => (
              <span key={d} className="text-xs px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100">
                {DIET_LABELS[d] ?? d}
              </span>
            ))}
            {entry.allergens.length === 0 && entry.diets.length === 0 && (
              <span className="text-xs text-gray-400 italic">unclassified</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            disabled={isEditing}
            aria-label="Edit ingredient"
            className="text-orange-600 hover:text-orange-800 disabled:text-gray-300"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            aria-label="Delete ingredient"
            className="text-gray-400 hover:text-red-600 disabled:opacity-50 transition-colors"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
      {isEditing && <EditRow entry={entry} onDone={onDone} />}
    </div>
  );
}

export function IngredientsPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => fetchIngredients(),
    staleTime: 5 * 60 * 1000,
  });

  const searchLower = search.toLowerCase();
  const filtered = search
    ? entries.filter((e) =>
        e.displayAlias.includes(searchLower) ||
        e.aliases.some((a) => a.alias.includes(searchLower))
      )
    : entries;

  const unclassifiedCount = entries.filter(
    (e) => e.allergens.length === 0 && e.diets.length === 0,
  ).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingredient Catalog</h1>
          {!isLoading && (
            <p className="text-sm text-gray-500 mt-1">
              {entries.length} ingredients
              {unclassifiedCount > 0 && (
                <span className="text-amber-600"> · {unclassifiedCount} unclassified</span>
              )}
            </p>
          )}
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search ingredients…"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
      />

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">
          {search ? 'No ingredients match.' : 'No ingredients in catalog.'}
        </p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {filtered.map((entry) => (
            <IngredientRow
              key={entry.id}
              entry={entry}
              isEditing={editingId === entry.id}
              onEdit={() => setEditingId(entry.id)}
              onDone={() => setEditingId(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
