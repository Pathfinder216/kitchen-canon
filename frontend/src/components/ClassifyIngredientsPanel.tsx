import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createIngredientEntry } from '../api/ingredients';
import { useDietaryTags } from '../hooks/useDietaryTags';
import { CopyFromSimilar, type CopySource } from './nutrition/CopyFromSimilar';
import { NutritionEditor } from './nutrition/NutritionEditor';
import {
  draftToNutrition,
  emptyNutritionDraft,
  nutritionToDraft,
  type NutritionDraft,
} from '../utils/nutrition';

interface ClassifyFormState {
  allergens: string[];
  diets: string[];
  nutrition: NutritionDraft;
  /** The similar entry the form was prefilled from, if any (its aisle is saved too). */
  picked?: CopySource;
}

interface Props {
  unknownIngredients: string[];
  /** Called after catalog entries are saved; use to invalidate dependent queries. */
  onSaved?: () => void | Promise<void>;
  onDone: () => void;
}

export function ClassifyIngredientsPanel({ unknownIngredients, onSaved, onDone }: Props) {
  const queryClient = useQueryClient();
  const { allergens: ALLERGENS, diets: DIETS, allergenLabels: ALLERGEN_LABELS, dietLabels: DIET_LABELS } = useDietaryTags();
  const [forms, setForms] = useState<Record<string, ClassifyFormState>>(() =>
    Object.fromEntries(
      unknownIngredients.map((n) => [n, { allergens: [], diets: [], nutrition: emptyNutritionDraft() }]),
    )
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(name: string, kind: 'allergens' | 'diets', tag: string) {
    setForms((prev) => {
      const current = prev[name][kind];
      return {
        ...prev,
        [name]: {
          ...prev[name],
          [kind]: current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
        },
      };
    });
  }

  function pickSuggestion(name: string, s: CopySource) {
    setForms((prev) => ({
      ...prev,
      [name]: {
        allergens: s.allergens,
        diets: s.diets,
        nutrition: s.nutrition ? nutritionToDraft(s.nutrition, 'copied') : prev[name].nutrition,
        picked: s,
      },
    }));
  }

  function setNutrition(name: string, nutrition: NutritionDraft) {
    setForms((prev) => ({ ...prev, [name]: { ...prev[name], nutrition } }));
  }

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      for (const name of unknownIngredients) {
        const { allergens, diets, picked } = forms[name];
        const nutrition = draftToNutrition(forms[name].nutrition);
        await createIngredientEntry({
          name,
          allergens,
          diets,
          ...(picked?.aisle && { aisle: picked.aisle }),
          ...(nutrition && { nutrition }),
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      await onSaved?.();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-amber-800">Unclassified ingredients</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Tag these ingredients so dietary info can be calculated accurately.
          </p>
        </div>
        <button type="button" onClick={onDone} className="text-amber-500 hover:text-amber-700 text-lg leading-none shrink-0">×</button>
      </div>

      {unknownIngredients.map((name) => (
        <div key={name} className="bg-white border border-amber-100 rounded-lg p-3 space-y-2">
          <p className="text-sm font-medium text-gray-800 capitalize">{name}</p>
          <CopyFromSimilar
            name={name}
            selectedId={forms[name].picked?.id}
            onPick={(s) => pickSuggestion(name, s)}
          />
          {forms[name].picked && (
            <p className="text-xs text-amber-700">
              {forms[name].picked.nutrition ? 'Tags and nutrition' : 'Tags'} copied from
              "{forms[name].picked.displayAlias}" — review, then save.
            </p>
          )}
          <div>
            <p className="text-xs text-gray-500 mb-1">Allergens</p>
            <div className="flex flex-wrap gap-1.5">
              {ALLERGENS.map((a) => {
                const checked = forms[name].allergens.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleTag(name, 'allergens', a)}
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
            <p className="text-xs text-gray-500 mb-1">Compatible diets</p>
            <div className="flex flex-wrap gap-1.5">
              {DIETS.map((d) => {
                const checked = forms[name].diets.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleTag(name, 'diets', d)}
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
          <NutritionEditor
            ingredientName={name}
            value={forms[name].nutrition}
            onChange={(d) => setNutrition(name, d)}
          />
        </div>
      ))}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={submitting}
        className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
      >
        {submitting ? 'Saving…' : 'Save & recalculate'}
      </button>
    </div>
  );
}
