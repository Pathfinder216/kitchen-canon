import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRecipes } from '../hooks/useRecipes';
import { useCreateMealPlan, useMealPlan, useUpdateMealPlan } from '../hooks/useMealPlans';
import { FilterPanel } from '../components/FilterPanel';
import { apiGet } from '../api/client';
import type { Recipe } from '../types/recipe';
import type { MealPlanDetail } from '../types/meal-plan';

// ── Types ────────────────────────────────────────────────────────────────────

interface SelectedRecipe {
  recipeId: string;
  title: string;
  defaultServings: number;
  servings: number;
}

interface MediaItem { id: string; type: string; path: string; }

async function fetchCoverPhoto(recipeId: string): Promise<MediaItem | null> {
  const res = await fetch(`/api/recipes/${recipeId}/media`);
  if (!res.ok) return null;
  const items: MediaItem[] = await res.json();
  return items.find((m) => m.type === 'image') ?? null;
}

// ── Selected recipe cover thumbnail ──────────────────────────────────────────

function SelectedRecipeCover({ recipeId }: { recipeId: string }) {
  const { data: cover = null } = useQuery({
    queryKey: ['cover-photo', recipeId],
    queryFn: () => fetchCoverPhoto(recipeId),
    staleTime: 60_000,
  });

  return (
    <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
      {cover
        ? <img src={cover.path} alt="" className="w-full h-full object-cover" />
        : <span className="text-base opacity-30">🍽</span>
      }
    </div>
  );
}

// ── Browser recipe card ───────────────────────────────────────────────────────

interface BrowserRecipeCardProps {
  recipe: Recipe;
  isAdded: boolean;
  onAdd: () => void;
  onView: () => void;
}

function BrowserRecipeCard({ recipe, isAdded, onAdd, onView }: BrowserRecipeCardProps) {
  const { data: cover = null } = useQuery({
    queryKey: ['cover-photo', recipe.id],
    queryFn: () => fetchCoverPhoto(recipe.id),
    staleTime: 60_000,
  });

  return (
    <div className="flex items-center gap-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      {/* Cover photo */}
      <button
        type="button"
        onClick={onView}
        className="w-14 h-14 shrink-0 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-orange-400"
        aria-label={`Preview ${recipe.title}`}
      >
        {cover ? (
          <img src={cover.path} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl opacity-30">🍽</span>
        )}
      </button>

      {/* Text — clicking opens preview */}
      <button type="button" onClick={onView} className="flex-1 min-w-0 text-left focus:outline-none group">
        <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-orange-600 transition-colors">
          {recipe.title}
        </h3>
        <div className="flex flex-wrap gap-x-2 text-xs text-gray-500 mt-0.5">
          {recipe.totalTime && <span>{recipe.totalTime} min</span>}
          <span>{recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</span>
          <span>{recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}</span>
        </div>
      </button>

      {/* Add button */}
      <button
        type="button"
        onClick={onAdd}
        disabled={isAdded}
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 ${
          isAdded
            ? 'bg-orange-100 text-orange-600 cursor-default'
            : 'bg-orange-500 text-white hover:bg-orange-600'
        }`}
        aria-label={isAdded ? 'Already added' : `Add ${recipe.title}`}
      >
        {isAdded ? '✓' : '+'}
      </button>
    </div>
  );
}

// ── Recipe preview modal ──────────────────────────────────────────────────────

interface RecipePreviewModalProps {
  recipeId: string;
  isAdded: boolean;
  currentServings: number | undefined;
  onAddOrUpdate: (recipeId: string, title: string, defaultServings: number, servings: number) => void;
  onClose: () => void;
}

function RecipePreviewModal({ recipeId, isAdded, currentServings, onAddOrUpdate, onClose }: RecipePreviewModalProps) {
  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => apiGet<Recipe>(`/recipes/${recipeId}`),
    staleTime: 60_000,
  });

  const [servings, setServings] = useState(currentServings ?? 1);

  useEffect(() => {
    if (recipe) setServings(currentServings ?? recipe.servings);
  }, [recipe, currentServings]);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 truncate pr-4">
            {recipe?.title ?? (isLoading ? 'Loading…' : '')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {isLoading && <p className="text-gray-500 text-sm">Loading recipe…</p>}

          {recipe && (
            <>
              {/* Metadata */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                {recipe.totalTime && <span>{recipe.totalTime} min total</span>}
                {recipe.activeTime && <span>{recipe.activeTime} min active</span>}
                <span>{recipe.servings} default servings</span>
                {recipe.source && <span className="truncate">{recipe.source}</span>}
              </div>

              {/* Ingredients */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Ingredients ({recipe.ingredients.length})
                </h3>
                <ul className="space-y-1">
                  {recipe.ingredients.map((ing) => (
                    <li key={ing.id} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-gray-400 shrink-0">
                        {ing.amount != null ? `${ing.amount}${ing.unit ? ' ' + ing.unit : ''}` : ing.unit ?? ''}
                      </span>
                      <span>{ing.name}{ing.isOptional && <span className="text-gray-400 ml-1">(optional)</span>}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Steps */}
              {recipe.steps.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Steps ({recipe.steps.length})
                  </h3>
                  <ol className="space-y-2">
                    {recipe.steps.map((step, i) => (
                      <li key={step.id} className="flex gap-3 text-sm text-gray-700">
                        <span className="shrink-0 w-5 h-5 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5">
                          {i + 1}
                        </span>
                        <span>{step.instruction}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — add/update */}
        <div className="border-t border-gray-200 px-5 py-4 flex items-center gap-4">
          <label htmlFor="modal-servings" className="text-sm text-gray-700 shrink-0">Servings:</label>
          <input
            id="modal-servings"
            type="number"
            min={1}
            value={servings}
            onChange={(e) => setServings(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            type="button"
            disabled={!recipe}
            onClick={() => {
              if (recipe) {
                onAddOrUpdate(recipe.id, recipe.title, recipe.servings, servings);
                onClose();
              }
            }}
            className="ml-auto bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {isAdded ? 'Update Servings' : 'Add to Meal'}
          </button>
          {recipe && (
            <Link
              to={`/recipes/${recipe.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-orange-600"
            >
              Open recipe ↗
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main form component ───────────────────────────────────────────────────────

interface MealPlanFormContentProps {
  initialPlan?: MealPlanDetail;
  isEdit: boolean;
  isRemake: boolean;
  planId?: string;
}

function MealPlanFormContent({ initialPlan, isEdit, isRemake, planId }: MealPlanFormContentProps) {
  const navigate = useNavigate();

  // Form fields
  const [name, setName] = useState(initialPlan?.name ?? '');
  // Remake: clear the date so user must pick a new one; edit: pre-fill
  const [date, setDate] = useState(isRemake ? '' : (initialPlan?.date ?? ''));
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRemake) dateRef.current?.focus();
  }, [isRemake]);
  const [time, setTime] = useState(initialPlan?.time ?? '');
  const [notes, setNotes] = useState(initialPlan?.notes ?? '');
  const [selected, setSelected] = useState<SelectedRecipe[]>(
    initialPlan?.recipes.map((r) => ({
      recipeId: r.recipeId,
      title: r.recipe.title,
      defaultServings: r.recipe.servings,
      servings: r.servings,
    })) ?? [],
  );

  // Recipe browser state
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    includeIngredients?: string;
    excludeIngredients?: string;
    labels?: string;
    categories?: string;
  }>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createMealPlan = useCreateMealPlan();
  const updateMealPlan = useUpdateMealPlan();
  const isPending = createMealPlan.isPending || updateMealPlan.isPending;

  const { data: recipesData, isLoading: recipesLoading } = useRecipes({
    search: search || undefined,
    page,
    ...filters,
  });

  const selectedIds = new Set(selected.map((s) => s.recipeId));

  function addRecipe(recipeId: string, title: string, defaultServings: number, servings: number) {
    setSelected((prev) =>
      prev.some((s) => s.recipeId === recipeId)
        ? prev.map((s) => s.recipeId === recipeId ? { ...s, servings } : s)
        : [...prev, { recipeId, title, defaultServings, servings }],
    );
  }

  function removeRecipe(recipeId: string) {
    setSelected((prev) => prev.filter((s) => s.recipeId !== recipeId));
  }

  function updateServings(recipeId: string, value: number) {
    setSelected((prev) => prev.map((s) => s.recipeId === recipeId ? { ...s, servings: value } : s));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    if (selected.length === 0) { setError('Add at least one recipe.'); return; }
    setError(null);

    const input = {
      name: name.trim(),
      date: date || undefined,
      time: time || undefined,
      notes: notes.trim() || undefined,
      recipes: selected.map((s, i) => ({ recipeId: s.recipeId, servings: s.servings, orderIndex: i })),
    };

    try {
      if (isEdit && planId) {
        await updateMealPlan.mutateAsync({ id: planId, ...input });
        navigate(`/meal-plans/${planId}`);
      } else {
        const plan = await createMealPlan.mutateAsync(input);
        navigate(`/meal-plans/${plan.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save meal plan');
    }
  }

  const base = 'rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <form onSubmit={handleSubmit}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Meal Plan' : isRemake ? 'Remake Meal Plan' : 'New Meal Plan'}
        </h1>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
          >
            {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Meal Plan'}
          </button>
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/meal-plans/${planId}` : '/meal-plans')}
            className="border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium px-5 py-2 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Top fields */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="col-span-2">
          <label htmlFor="plan-name" className={labelClass}>Name *</label>
          <input
            id="plan-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sunday dinner"
            className={base + ' w-full'}
            required
          />
        </div>
        <div>
          <label htmlFor="plan-date" className={labelClass}>Date</label>
          <input
            ref={dateRef}
            id="plan-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={base + ' w-full'}
          />
        </div>
        <div>
          <label htmlFor="plan-time" className={labelClass}>Time</label>
          <input
            id="plan-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={base + ' w-full'}
          />
        </div>
        <div className="col-span-2 md:col-span-4">
          <label htmlFor="plan-notes" className={labelClass}>Notes</label>
          <textarea
            id="plan-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Occasion, guests, special requirements…"
            rows={2}
            className={base + ' w-full resize-none'}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* Two-panel layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* Left panel: recipe browser */}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Browse Recipes</h2>

          <div className="mb-2">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search recipes…"
              className={base + ' w-full'}
            />
          </div>

          <FilterPanel
            onFilterChange={(f) => { setFilters(f); setPage(1); }}
          />

          {recipesLoading && <p className="text-gray-500 text-sm mt-2">Loading recipes…</p>}

          {recipesData && recipesData.recipes.length === 0 && (
            <p className="text-gray-500 text-sm mt-2">No recipes found.</p>
          )}

          {recipesData && recipesData.recipes.length > 0 && (
            <>
              <div className="grid gap-2 mt-2">
                {recipesData.recipes.map((recipe) => (
                  <BrowserRecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    isAdded={selectedIds.has(recipe.id)}
                    onAdd={() => addRecipe(recipe.id, recipe.title, recipe.servings, recipe.servings)}
                    onView={() => setPreviewId(recipe.id)}
                  />
                ))}
              </div>

              {recipesData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {recipesData.pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(recipesData.pagination.totalPages, p + 1))}
                    disabled={page === recipesData.pagination.totalPages}
                    className="px-3 py-1 text-sm rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right panel: selected recipes */}
        <div className="lg:w-80 shrink-0 w-full">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            Meal{selected.length > 0 ? ` (${selected.length})` : ''}
          </h2>

          {selected.length === 0 ? (
            <p className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg p-4 text-center">
              Add recipes from the list on the left.
            </p>
          ) : (
            <ul className="space-y-2">
              {selected.map((s) => (
                <li
                  key={s.recipeId}
                  className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2"
                >
                  <div className="flex items-start gap-2">
                    <SelectedRecipeCover recipeId={s.recipeId} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <Link
                          to={`/recipes/${s.recipeId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-gray-800 hover:text-orange-600 truncate"
                        >
                          {s.title}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeRecipe(s.recipeId)}
                          className="text-gray-400 hover:text-red-500 shrink-0 text-sm font-bold"
                          aria-label={`Remove ${s.title}`}
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <label htmlFor={`srv-${s.recipeId}`} className="text-xs text-gray-500">Servings:</label>
                        <input
                          id={`srv-${s.recipeId}`}
                          type="number"
                          min={1}
                          value={s.servings}
                          onChange={(e) => updateServings(s.recipeId, Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 border border-orange-300 rounded px-2 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-400"
                        />
                        <span className="text-xs text-gray-400">(default: {s.defaultServings})</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recipe preview modal */}
      {previewId && (
        <RecipePreviewModal
          recipeId={previewId}
          isAdded={selectedIds.has(previewId)}
          currentServings={selected.find((s) => s.recipeId === previewId)?.servings}
          onAddOrUpdate={addRecipe}
          onClose={() => setPreviewId(null)}
        />
      )}
    </form>
  );
}

// ── Route component (handles edit-mode data loading) ─────────────────────────

export function MealPlanFormPage() {
  const { id: planId } = useParams<{ id?: string }>();
  const { state } = useLocation();
  const isEdit = !!planId;
  const isRemake = !isEdit && !!state?.remakeFrom;

  const { data: existingPlan, isLoading } = useMealPlan(planId ?? '');

  if (isEdit && isLoading) return <p className="text-gray-500">Loading meal plan…</p>;

  // Edit mode: use fetched plan. Remake mode: use state passed from detail page.
  const initialPlan: MealPlanDetail | undefined = isEdit ? existingPlan : (isRemake ? state.remakeFrom : undefined);

  return (
    <div className="max-w-6xl mx-auto">
      <MealPlanFormContent
        key={planId ?? 'new'}
        initialPlan={initialPlan}
        isEdit={isEdit}
        isRemake={isRemake}
        planId={planId}
      />
    </div>
  );
}
