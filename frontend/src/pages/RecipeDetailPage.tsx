import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRecipe } from '../hooks/useRecipes';
import { useScaling } from '../hooks/useScaling';
import { RecipeMedia } from '../components/RecipeMedia';
import { StepMedia } from '../components/StepMedia';
import type { Recipe } from '../types/recipe';
import { COURSE_DISPLAY_NAMES } from '../api/courses';
import { resolveIngredientRefs } from '../utils/resolveIngredientRefs';
import { fetchSubstitutionsForRecipe, type Substitution } from '../api/substitutions';
import { apiGet } from '../api/client';
import { useDietaryTags } from '../hooks/useDietaryTags';
import type { DietaryInfo } from '../types/meal-plan';
import { RecipeActionsBar, ExportActions } from '../components/recipe-detail/RecipeActionsBar';
import { ServingScaler } from '../components/recipe-detail/ServingScaler';
import { DietaryBadges } from '../components/recipe-detail/DietaryBadges';
import { RecipeNotes } from '../components/recipe-detail/RecipeNotes';
import { PrintLayout } from '../components/recipe-detail/PrintLayout';
import { RecipeIngredientList } from '../components/recipe-detail/RecipeIngredientList';

// Inner component receives the loaded recipe — hooks are safe here.
function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const locationState = location.state as { from?: { label: string; href: string }; targetServings?: number } | null;
  const backLink = locationState?.from ?? { label: 'Back to recipes', href: '/' };
  const { allergenLabels: ALLERGEN_LABELS, dietLabels: DIET_LABELS } = useDietaryTags();
  const { targetServings, setTargetServings, scaleIngredient } = useScaling(locationState?.targetServings ?? recipe.servings);
  const scaledIngredients = recipe.ingredients.map(scaleIngredient);

  // Substitution-swap state (parent of SubstitutionsMenu) — feeds the {ref} name overrides.
  const [activeSwaps, setActiveSwaps] = useState<Record<string, Substitution>>({});

  const { data: allSubs = [] } = useQuery({
    queryKey: ['recipe-substitutions', id],
    queryFn: () => fetchSubstitutionsForRecipe(id!),
  });

  const { data: dietaryInfo } = useQuery<DietaryInfo>({
    queryKey: ['recipe-dietary', id],
    queryFn: () => apiGet(`/recipes/${id}/dietary-info`),
    staleTime: 5 * 60 * 1000,
  });

  // Map ingredient ID → available substitutions
  const subsByIngredientId: Record<string, Substitution[]> = {};
  for (const ing of recipe.ingredients) {
    const matches = allSubs.filter((s) => s.fromIngredient === ing.name.toLowerCase());
    if (matches.length > 0) subsByIngredientId[ing.id] = matches;
  }

  // Scaled + swap-adjusted amounts; names kept original so {ref} lookup still works
  const finalIngredients = scaledIngredients.map((ing) => {
    const swap = activeSwaps[ing.id];
    if (!swap) return ing;
    return { ...ing, amount: ing.amount !== null ? ing.amount * swap.ratio : null };
  });

  // Display name overrides keyed by ingredient ID (unambiguous even with duplicate names)
  const swapDisplayNames = new Map<string, string>();
  for (const [ingId, swap] of Object.entries(activeSwaps)) {
    swapDisplayNames.set(ingId, swap.toIngredient);
  }

  function removeSwap(ingId: string) {
    setActiveSwaps((s) => { const n = { ...s }; delete n[ingId]; return n; });
  }

  return (
    <div>
      {/* Print layout — only visible when printing */}
      <PrintLayout recipe={recipe} finalIngredients={finalIngredients} swapDisplayNames={swapDisplayNames} targetServings={targetServings} />

      {/* Screen layout — hidden when printing */}
      <div className="print:hidden">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <Link to={backLink.href} className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block">
              &larr; {backLink.label}
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{recipe.title}</h1>
            <div className="flex gap-3 text-sm text-gray-500 mt-1">
              {recipe.totalTime && <span>Total: {recipe.totalTime} min</span>}
              {recipe.activeTime && <span>Active: {recipe.activeTime} min</span>}
            </div>
          </div>
          <RecipeActionsBar recipe={recipe} targetServings={targetServings} activeSwaps={activeSwaps} />
        </div>

        {recipe.archived && (
          <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-2 mb-4 text-sm text-amber-700">
            This recipe is archived.
          </div>
        )}

        {/* Cover photo */}
        <RecipeMedia recipeId={id!} readOnly />

        {/* Source */}
        {recipe.source && (
          <p className="text-sm text-gray-500 mb-4">
            Source:{' '}
            {recipe.source.startsWith('http') ? (
              <a href={recipe.source} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700 underline">
                {recipe.source}
              </a>
            ) : (
              recipe.source
            )}
          </p>
        )}

        {/* Courses & Labels */}
        {(recipe.courses.length > 0 || recipe.labels.some((rl) => rl.label.type === 'manual')) && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {recipe.courses.map((rc) => (
              <span key={rc.courseType} className="px-2.5 py-0.5 text-xs rounded-full bg-blue-50 border border-blue-200 text-blue-700">
                {COURSE_DISPLAY_NAMES[rc.courseType] ?? rc.courseType}
              </span>
            ))}
            {recipe.labels.filter((rl) => rl.label.type === 'manual').map((rl) => (
              <span key={rl.labelId} title={rl.label.type} className="px-2.5 py-0.5 text-xs rounded-full bg-gray-100 border border-gray-200 text-gray-600">
                {rl.label.name}
              </span>
            ))}
          </div>
        )}

        {/* Dietary info (auto-computed from ingredients) */}
        <DietaryBadges dietaryInfo={dietaryInfo} allergenLabels={ALLERGEN_LABELS} dietLabels={DIET_LABELS} />

        {/* Ingredients with serving scaler */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Ingredients</h2>
            <ServingScaler baseServings={recipe.servings} targetServings={targetServings} setTargetServings={setTargetServings} />
          </div>

          <RecipeIngredientList
            ingredients={recipe.ingredients}
            scaledIngredients={scaledIngredients}
            activeSwaps={activeSwaps}
            subsByIngredientId={subsByIngredientId}
            onApplySwap={(ingId, sub) => setActiveSwaps((s) => ({ ...s, [ingId]: sub }))}
            onRemoveSwap={removeSwap}
            onClearSwaps={() => setActiveSwaps({})}
          />
        </div>

        {/* Steps */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Steps</h2>
          {recipe.steps.length === 0 ? (
            <p className="text-gray-500 text-sm">No steps listed.</p>
          ) : (
            <ol className="space-y-4">
              {recipe.steps.map((step, index) => (
                <li key={step.id} className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </span>
                  <div className="flex-1 pt-0.5">
                    <p className="text-gray-900 text-sm">
                      {resolveIngredientRefs(step.instruction, finalIngredients, 1, swapDisplayNames)}
                    </p>
                    {!!step.timeMinutes && (
                      <p className="text-xs text-gray-500 mt-1">
                        {step.timeMinutes} min ({step.isActiveTime ? 'active' : 'inactive'})
                      </p>
                    )}
                    <StepMedia stepId={step.id} readOnly />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Author + personal notes — shown after ingredients and steps */}
        <RecipeNotes authorNotes={recipe.authorNotes} personalNotes={recipe.personalNotes} />

        {/* Version Info + Export */}
        <div className="border-t border-gray-200 pt-4 mt-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400">
              Last updated {new Date(recipe.updatedAt).toLocaleDateString()}
            </p>
            <Link to={`/recipes/${id}/versions`} className="text-xs text-orange-600 hover:text-orange-700">
              View version history
            </Link>
          </div>
          <ExportActions recipe={recipe} finalIngredients={finalIngredients} swapDisplayNames={swapDisplayNames} targetServings={targetServings} />
        </div>
      </div>{/* end print:hidden */}
    </div>
  );
}

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: recipe, isLoading, error } = useRecipe(id);

  if (isLoading) return <p className="text-gray-500">Loading recipe...</p>;
  if (error || !recipe) return <p className="text-red-600">Recipe not found.</p>;

  return <RecipeDetail recipe={recipe} />;
}
