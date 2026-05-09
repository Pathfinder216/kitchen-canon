import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchIngredients, updateIngredientEntry, type CatalogEntry } from '../api/ingredients';
import { ALLERGENS, DIETS, ALLERGEN_LABELS, DIET_LABELS } from '../constants/dietaryTags';

function EditRow({ entry, onDone }: { entry: CatalogEntry; onDone: () => void }) {
  const queryClient = useQueryClient();
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

function IngredientRow({ entry, isEditing, onEdit, onDone }: {
  entry: CatalogEntry;
  isEditing: boolean;
  onEdit: () => void;
  onDone: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3 pr-6">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{entry.name}</p>
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
        <button
          type="button"
          onClick={onEdit}
          disabled={isEditing}
          aria-label="Edit ingredient"
          className="text-orange-600 hover:text-orange-800 disabled:text-gray-300 shrink-0"
        >
          <PencilIcon />
        </button>
      </div>
      {isEditing && <EditRow entry={entry} onDone={onDone} />}
    </div>
  );
}

export function IngredientsPage() {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => fetchIngredients(),
    staleTime: 5 * 60 * 1000,
  });

  const searchLower = search.toLowerCase();
  const filtered = search
    ? entries.filter((e) => e.name.includes(searchLower))
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
        placeholder="Search ingredients..."
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
