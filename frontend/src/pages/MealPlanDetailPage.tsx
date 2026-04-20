import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GroceryList } from '../components/GroceryList';
import { useMealPlan, useToggleGroceryItem } from '../hooks/useMealPlans';
import { createIngredientEntry, fetchIngredients } from '../api/ingredients';
import { ALLERGENS, DIETS, ALLERGEN_LABELS, DIET_LABELS } from '../constants/dietaryTags';
import type { DietaryInfo } from '../types/meal-plan';

interface MediaItem { id: string; type: string; path: string; }

async function fetchCoverPhoto(recipeId: string): Promise<MediaItem | null> {
  const res = await fetch(`/api/recipes/${recipeId}/media`);
  if (!res.ok) return null;
  const items: MediaItem[] = await res.json();
  return items.find((m) => m.type === 'image') ?? null;
}

function MealRecipeRow({ mr, planId }: {
  mr: { id: string; recipeId: string; servings: number; recipeVersion: number; substitutions: Record<string, { toIngredient: string; ratio: number }> | null; recipe: { title: string } };
  planId: string;
}) {
  const { data: cover = null } = useQuery({
    queryKey: ['cover-photo', mr.recipeId],
    queryFn: () => fetchCoverPhoto(mr.recipeId),
    staleTime: 60_000,
  });

  return (
    <li className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
        {cover
          ? <img src={cover.path} alt="" className="w-full h-full object-cover" />
          : <span className="text-base opacity-30">🍽</span>
        }
      </div>
      <div className="flex-1">
        <Link
          to={`/recipes/${mr.recipeId}`}
          state={{ from: { label: 'Back to meal', href: `/meal-plans/${planId}` } }}
          className="font-medium text-gray-900 hover:text-orange-600 transition-colors"
        >
          {mr.recipe.title}
        </Link>
        <p className="text-xs text-gray-500 mt-0.5">
          {mr.servings} servings
          {mr.recipeVersion > 1 && ` · v${mr.recipeVersion}`}
        </p>
      </div>
      <Link
        to={`/recipes/${mr.recipeId}/cook`}
        state={{
          from: { label: 'Back to meal plan', href: `/meal-plans/${planId}` },
          targetServings: mr.servings,
          activeSwaps: mr.substitutions ?? undefined,
        }}
        className="text-sm text-orange-600 hover:text-orange-800 font-medium"
      >
        Cook →
      </Link>
    </li>
  );
}

// ── Classify unknown ingredients ─────────────────────────────────────────────

interface ClassifyFormState {
  allergens: string[];
  diets: string[];
}

function ClassifyIngredientsPanel({
  unknownIngredients,
  mealPlanId,
  onDone,
}: {
  unknownIngredients: string[];
  mealPlanId: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [forms, setForms] = useState<Record<string, ClassifyFormState>>(() =>
    Object.fromEntries(unknownIngredients.map((n) => [n, { allergens: [], diets: [] }]))
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

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      for (const name of unknownIngredients) {
        const existing = await fetchIngredients(name);
        const match = existing.find((e) => e.name === name.toLowerCase().trim());
        if (match) {
          // Already added by another concurrent call; skip
          continue;
        }
        await createIngredientEntry({ name, ...forms[name] });
      }
      // Invalidate ingredients + meal plan so dietary info refreshes
      await queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      await queryClient.invalidateQueries({ queryKey: ['meal-plan', mealPlanId] });
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

// ── Dietary info display ──────────────────────────────────────────────────────

function DietaryInfoSection({
  info,
  planId,
}: {
  info: DietaryInfo;
  planId: string;
}) {
  const [classifying, setClassifying] = useState(false);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">Dietary Info</h2>

      {info.allergens.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Contains allergens</p>
          <div className="flex flex-wrap gap-1.5">
            {info.allergens.map((a) => (
              <span key={a} className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                {ALLERGEN_LABELS[a] ?? a}
              </span>
            ))}
          </div>
        </div>
      )}

      {info.diets.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Diet compatible</p>
          <div className="flex flex-wrap gap-1.5">
            {info.diets.map((d) => (
              <span key={d} className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                {DIET_LABELS[d] ?? d}
              </span>
            ))}
          </div>
        </div>
      )}

      {info.allergens.length === 0 && info.diets.length === 0 && info.unknownIngredients.length === 0 && (
        <p className="text-sm text-gray-500">No allergens detected. Compatible with all tracked diets.</p>
      )}

      {info.unknownIngredients.length > 0 && !classifying && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-800">
            {info.unknownIngredients.length} ingredient{info.unknownIngredients.length > 1 ? 's' : ''} not in catalog — diet info may be incomplete.
          </p>
          <button
            type="button"
            onClick={() => setClassifying(true)}
            className="text-xs font-medium text-amber-700 hover:text-amber-900 underline ml-2 shrink-0"
          >
            Classify
          </button>
        </div>
      )}

      {classifying && (
        <ClassifyIngredientsPanel
          unknownIngredients={info.unknownIngredients}
          mealPlanId={planId}
          onDone={() => setClassifying(false)}
        />
      )}
    </section>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatTime(time: string) {
  const [hourStr, minuteStr] = time.split(':');
  const hour = parseInt(hourStr, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${minuteStr} ${period}`;
}

function formatCreatedAt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function MealPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: plan, isLoading, error } = useMealPlan(id!);
  const toggleItem = useToggleGroceryItem(id!);

  if (isLoading) return <p className="text-gray-500">Loading meal plan…</p>;
  if (error || !plan) return <p className="text-red-600">Meal plan not found.</p>;

  const totalPurchased = plan.groceryList.filter((i) => i.purchased).length;
  const progress = plan.groceryList.length > 0
    ? Math.round((totalPurchased / plan.groceryList.length) * 100)
    : 0;

  function handleRemake() {
    navigate('/meal-plans/new', {
      state: {
        remakeFrom: {
          name: plan!.name,
          time: plan!.time,
          notes: plan!.notes,
          recipes: plan!.recipes,
        },
      },
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/meal-plans" className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block">
            ← Back to meal plans
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {plan.name ?? 'Meal Plan'}
          </h1>
          {plan.date && (
            <p className="text-sm text-gray-700 mt-1 font-medium">
              {formatDate(plan.date)}{plan.time && ` at ${formatTime(plan.time)}`}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">Created {formatCreatedAt(plan.createdAt)}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            to={`/meal-plans/${id}/edit`}
            className="border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={handleRemake}
            className="border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Remake
          </button>
        </div>
      </div>

      {/* Notes */}
      {plan.notes && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.notes}</p>
        </section>
      )}

      {/* Recipes */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recipes</h2>
        <ul className="space-y-2">
          {plan.recipes.map((mr) => (
            <MealRecipeRow key={mr.id} mr={mr} planId={id!} />
          ))}
        </ul>
      </section>

      {/* Dietary info */}
      {plan.dietaryInfo && (
        <DietaryInfoSection info={plan.dietaryInfo} planId={id!} />
      )}

      {/* Grocery list */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Grocery List</h2>
          {plan.groceryList.length > 0 && (
            <span className="text-sm text-gray-500">
              {totalPurchased}/{plan.groceryList.length} · {progress}%
            </span>
          )}
        </div>

        {plan.groceryList.length > 0 && (
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
            <div
              className="bg-orange-500 h-1.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <GroceryList
            items={plan.groceryList}
            onToggle={(itemId, purchased) =>
              toggleItem.mutate({ itemId, purchased })
            }
          />
        </div>
      </section>
    </div>
  );
}
