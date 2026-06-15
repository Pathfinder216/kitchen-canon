import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createIngredientEntry } from '../../api/ingredients';
import { useDietaryTags } from '../../hooks/useDietaryTags';

export function InlineClassifyPanel({ ingredientName, onSaved, onClose }: {
  ingredientName: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { allergens: ALLERGENS, diets: DIETS, allergenLabels: ALLERGEN_LABELS, dietLabels: DIET_LABELS } = useDietaryTags();
  const [allergens, setAllergens] = useState<string[]>([]);
  const [diets, setDiets] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(kind: 'allergens' | 'diets', tag: string) {
    if (kind === 'allergens') {
      setAllergens((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
    } else {
      setDiets((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await createIngredientEntry({ name: ingredientName.toLowerCase().trim(), allergens, diets });
      await queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ml-7 mt-1 mb-1 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-amber-800">Classify "{ingredientName}"</p>
        <button type="button" onClick={onClose} className="text-amber-500 hover:text-amber-700 text-base leading-none">×</button>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Allergens</p>
        <div className="flex flex-wrap gap-1.5">
          {ALLERGENS.map((a) => {
            const checked = allergens.includes(a);
            return (
              <button key={a} type="button" onClick={() => toggle('allergens', a)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${checked ? 'bg-red-100 border-red-300 text-red-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {ALLERGEN_LABELS[a]}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Compatible diets</p>
        <div className="flex flex-wrap gap-1.5">
          {DIETS.map((d) => {
            const checked = diets.includes(d);
            return (
              <button key={d} type="button" onClick={() => toggle('diets', d)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${checked ? 'bg-green-100 border-green-300 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {DIET_LABELS[d]}
              </button>
            );
          })}
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving}
          className="text-xs font-medium bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-md transition-colors">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onClose}
          className="text-xs font-medium text-gray-600 px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors">
          Skip
        </button>
      </div>
    </div>
  );
}
