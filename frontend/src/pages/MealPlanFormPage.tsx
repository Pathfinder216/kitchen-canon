import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useCreateMealPlan, useMealPlan, useUpdateMealPlan } from '../hooks/useMealPlans';
import type { Recipe } from '../types/recipe';
import type { ActiveSwaps, MealPlanDetail } from '../types/meal-plan';
import { PlanDetailsFields } from '../components/meal-plan-form/PlanDetailsFields';
import { RecipeBrowser } from '../components/meal-plan-form/RecipeBrowser';
import { SelectedRecipesList } from '../components/meal-plan-form/SelectedRecipesList';
import { RecipePreviewModal } from '../components/meal-plan-form/RecipePreviewModal';
import type { SelectedRecipe } from '../components/meal-plan-form/types';

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
      activeSwaps: (r.substitutions as ActiveSwaps | null) ?? {},
    })) ?? [],
  );

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createMealPlan = useCreateMealPlan();
  const updateMealPlan = useUpdateMealPlan();
  const isPending = createMealPlan.isPending || updateMealPlan.isPending;

  const selectedIds = new Set(selected.map((s) => s.recipeId));

  function addRecipe(recipeId: string, title: string, defaultServings: number, servings: number, activeSwaps: ActiveSwaps = {}) {
    setSelected((prev) =>
      prev.some((s) => s.recipeId === recipeId)
        ? prev.map((s) => s.recipeId === recipeId ? { ...s, servings, activeSwaps } : s)
        : [...prev, { recipeId, title, defaultServings, servings, activeSwaps }],
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
      recipes: selected.map((s, i) => ({
        recipeId: s.recipeId,
        servings: s.servings,
        orderIndex: i,
        substitutions: Object.keys(s.activeSwaps).length > 0 ? s.activeSwaps : undefined,
      })),
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

      <PlanDetailsFields
        ref={dateRef}
        name={name}
        onNameChange={setName}
        date={date}
        onDateChange={setDate}
        time={time}
        onTimeChange={setTime}
        notes={notes}
        onNotesChange={setNotes}
      />

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* Two-panel layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <RecipeBrowser
          selectedIds={selectedIds}
          onAdd={(recipe: Recipe) => addRecipe(recipe.id, recipe.title, recipe.servings, recipe.servings)}
          onRemove={removeRecipe}
          onView={setPreviewId}
        />

        <SelectedRecipesList
          selected={selected}
          onRemove={removeRecipe}
          onUpdateServings={updateServings}
        />
      </div>

      {/* Recipe preview modal */}
      {previewId && (
        <RecipePreviewModal
          recipeId={previewId}
          isAdded={selectedIds.has(previewId)}
          currentServings={selected.find((s) => s.recipeId === previewId)?.servings}
          currentSwaps={selected.find((s) => s.recipeId === previewId)?.activeSwaps ?? {}}
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
