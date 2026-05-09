import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRecipe, useArchiveRecipe, useDeleteRecipePermanently } from '../hooks/useRecipes';
import { useScaling, formatScaledAmount } from '../hooks/useScaling';
import { RecipeMedia } from '../components/RecipeMedia';
import { StepMedia } from '../components/StepMedia';
import type { Recipe } from '../types/recipe';
import { COURSE_DISPLAY_NAMES } from '../api/courses';
import { getIngredientAlias } from '../utils/ingredientAliases';
import { resolveIngredientRefs, resolveIngredientRefsText } from '../utils/resolveIngredientRefs';
import { fetchSubstitutionsForRecipe, type Substitution } from '../api/substitutions';
import { exportRecipeAsText, exportRecipeAsJson } from '../utils/exportRecipe';
import { apiGet } from '../api/client';
import { ALLERGEN_LABELS, DIET_LABELS } from '../constants/dietaryTags';
import type { DietaryInfo } from '../types/meal-plan';

function SwapIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M13.2 2.24a.75.75 0 00.04 1.06l2.1 1.95H6.75a.75.75 0 000 1.5h8.59l-2.1 1.95a.75.75 0 101.02 1.1l3.5-3.25a.75.75 0 000-1.1l-3.5-3.25a.75.75 0 00-1.06.04zm-6.4 8a.75.75 0 00-1.06-.04l-3.5 3.25a.75.75 0 000 1.1l3.5 3.25a.75.75 0 101.02-1.1l-2.1-1.95h8.59a.75.75 0 000-1.5H4.66l2.1-1.95a.75.75 0 00.04-1.06z" clipRule="evenodd" />
    </svg>
  );
}

// Inner component receives the loaded recipe — hooks are safe here.
function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const locationState = location.state as { from?: { label: string; href: string }; targetServings?: number } | null;
  const backLink = locationState?.from ?? { label: 'Back to recipes', href: '/' };
  const archiveMutation = useArchiveRecipe();
  const deleteMutation = useDeleteRecipePermanently();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { targetServings, setTargetServings, scaleIngredient } = useScaling(locationState?.targetServings ?? recipe.servings);
  const scaledIngredients = recipe.ingredients.map(scaleIngredient);

  const [activeSwaps, setActiveSwaps] = useState<Record<string, Substitution>>({});
  const [openSwapId, setOpenSwapId] = useState<string | null>(null);

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

  function handleArchive() {
    if (!id) return;
    archiveMutation.mutate(id);
  }

  function handleDelete() {
    if (!id) return;
    deleteMutation.mutate(id);
  }

  function removeSwap(ingId: string) {
    setActiveSwaps((s) => { const n = { ...s }; delete n[ingId]; return n; });
  }

  return (
    <div>
      {/* Print layout — only visible when printing */}
      <div className="hidden print:block text-black">
        <h1 className="text-2xl font-bold mb-1">{recipe.title}</h1>
        <div className="flex gap-4 text-sm text-gray-600 mb-1">
          {recipe.totalTime && <span>Total: {recipe.totalTime} min</span>}
          {recipe.activeTime && <span>Active: {recipe.activeTime} min</span>}
          <span>{targetServings} serving{targetServings !== 1 ? 's' : ''}</span>
        </div>
        {recipe.source && (
          <p className="text-sm text-gray-500 mb-1">Source: {recipe.source}</p>
        )}
        {recipe.courses.length > 0 && (
          <p className="text-sm text-gray-500 mb-3">
            {recipe.courses.map((rc) => COURSE_DISPLAY_NAMES[rc.courseType] ?? rc.courseType).join(', ')}
          </p>
        )}

        <h2 className="text-base font-semibold mt-4 mb-1">Ingredients</h2>
        <ul className="text-sm space-y-0.5 mb-4 columns-2">
          {finalIngredients.map((ing) => (
            <li key={ing.id}>
              {ing.amount !== null && (
                <span className="font-medium">
                  {formatScaledAmount(ing.amount)}{' '}
                  {ing.unit}{' '}
                </span>
              )}
              {swapDisplayNames.get(ing.id) ?? ing.name}
              {!swapDisplayNames.has(ing.id) && getIngredientAlias(ing.name) && <span className="text-gray-400"> ({getIngredientAlias(ing.name)})</span>}
              {ing.isOptional && <span className="text-gray-400"> (optional)</span>}
            </li>
          ))}
        </ul>

        <h2 className="text-base font-semibold mb-1">Steps</h2>
        <ol className="text-sm space-y-2 mb-4">
          {recipe.steps.map((step, index) => (
            <li key={step.id} className="flex gap-2">
              <span className="font-semibold shrink-0">{index + 1}.</span>
              <span>
                {resolveIngredientRefsText(step.instruction, finalIngredients, 1, swapDisplayNames)}
                {!!step.timeMinutes && (
                  <span className="text-gray-500"> ({step.timeMinutes} min{step.isActiveTime ? ', active' : ''})</span>
                )}
              </span>
            </li>
          ))}
        </ol>

        {recipe.authorNotes && (
          <div className="mb-3">
            <h3 className="text-sm font-semibold mb-0.5">Author Notes</h3>
            <p className="text-sm">{recipe.authorNotes}</p>
          </div>
        )}
        {recipe.personalNotes && (
          <div className="mb-3">
            <h3 className="text-sm font-semibold mb-0.5">Personal Notes</h3>
            <p className="text-sm">{recipe.personalNotes}</p>
          </div>
        )}
      </div>

      {/* Screen layout — hidden when printing */}
      <div className="print:hidden">
        {/* Backdrop for swap popover */}
        {openSwapId && (
          <div className="fixed inset-0 z-40" onClick={() => setOpenSwapId(null)} />
        )}

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
          <div className="flex gap-2">
            {recipe.steps.length > 0 && (
              <Link
                to={`/recipes/${id}/cook`}
                state={{ targetServings, activeSwaps, from: { label: recipe.title, href: `/recipes/${id}` } }}
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Cook
              </Link>
            )}
            <Link
              to={`/recipes/${id}/edit`}
              className="bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 transition-colors"
            >
              Edit
            </Link>
            <button
              onClick={handleArchive}
              disabled={archiveMutation.isPending}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {recipe.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="border border-red-200 text-red-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Delete confirmation modal */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(false)} />
            <div className="relative bg-white rounded-xl shadow-xl p-6 mx-4 max-w-sm w-full">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete recipe?</h2>
              <p className="text-sm text-gray-600 mb-6">
                <span className="font-medium">"{recipe.title}"</span> and all its versions will be permanently deleted. This cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete permanently'}
                </button>
              </div>
            </div>
          </div>
        )}

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
        {(recipe.courses.length > 0 || recipe.labels.some((rl) => !rl.isAutoGenerated)) && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {recipe.courses.map((rc) => (
              <span key={rc.courseType} className="px-2.5 py-0.5 text-xs rounded-full bg-blue-50 border border-blue-200 text-blue-700">
                {COURSE_DISPLAY_NAMES[rc.courseType] ?? rc.courseType}
              </span>
            ))}
            {recipe.labels.filter((rl) => !rl.isAutoGenerated).map((rl) => (
              <span key={rl.labelId} title={rl.label.type} className="px-2.5 py-0.5 text-xs rounded-full bg-gray-100 border border-gray-200 text-gray-600">
                {rl.label.name}
              </span>
            ))}
          </div>
        )}

        {/* Dietary info (auto-computed from ingredients) */}
        {dietaryInfo && (dietaryInfo.allergens.length > 0 || dietaryInfo.diets.length > 0 || dietaryInfo.unknownIngredients.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {dietaryInfo.allergens.map((a) => (
              <span key={a} title="Contains allergen" className="px-2.5 py-0.5 text-xs rounded-full bg-red-50 border border-red-200 text-red-700">
                {ALLERGEN_LABELS[a] ?? a}
              </span>
            ))}
            {dietaryInfo.diets.map((d) => (
              <span key={d} title="Diet compatible" className="px-2.5 py-0.5 text-xs rounded-full bg-green-50 border border-green-200 text-green-700">
                {DIET_LABELS[d] ?? d}
              </span>
            ))}
            {dietaryInfo.unknownIngredients.length > 0 && (
              <span title={`Unclassified: ${dietaryInfo.unknownIngredients.join(', ')}`} className="px-2.5 py-0.5 text-xs rounded-full bg-amber-50 border border-amber-200 text-amber-700 cursor-help">
                {dietaryInfo.unknownIngredients.length} unclassified
              </span>
            )}
          </div>
        )}

        {/* Ingredients with serving scaler */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Ingredients</h2>
            <div className="flex items-center gap-2">
              <label htmlFor="servings-scale" className="text-sm text-gray-600">
                Servings:
              </label>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setTargetServings(Math.max(1, targetServings - 1))}
                  className="w-8 py-1 text-gray-600 hover:bg-gray-100 text-sm font-bold"
                  aria-label="Decrease servings"
                >
                  −
                </button>
                <input
                  id="servings-scale"
                  type="number"
                  min={1}
                  max={999}
                  value={targetServings}
                  onChange={(e) => setTargetServings(Math.max(1, Number(e.target.value)))}
                  onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                  className="w-12 text-center text-sm py-1 focus:outline-none border-x border-gray-300"
                />
                <button
                  onClick={() => setTargetServings(targetServings + 1)}
                  className="w-8 py-1 text-gray-600 hover:bg-gray-100 text-sm font-bold"
                  aria-label="Increase servings"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-orange-600 w-14 shrink-0 text-left whitespace-nowrap">
                {targetServings !== recipe.servings && `(×${(targetServings / recipe.servings).toFixed(2).replace(/\.?0+$/, '')})`}
              </span>
            </div>
          </div>

          {/* Active swap chips */}
          {Object.keys(activeSwaps).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {Object.entries(activeSwaps).map(([ingId, swap]) => {
                const originalIng = recipe.ingredients.find((i) => i.id === ingId);
                if (!originalIng) return null;
                return (
                  <span key={ingId} className="inline-flex items-center gap-1 text-xs bg-orange-50 border border-orange-200 text-orange-700 px-2 py-0.5 rounded-full">
                    {originalIng.name} → {swap.toIngredient}
                    <button
                      onClick={() => removeSwap(ingId)}
                      className="text-orange-400 hover:text-orange-600 ml-0.5 leading-none"
                      aria-label={`Remove substitution for ${originalIng.name}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              {Object.keys(activeSwaps).length > 1 && (
                <button
                  onClick={() => setActiveSwaps({})}
                  className="text-xs text-gray-400 hover:text-gray-600 px-1"
                >
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* Ingredient list with swap buttons */}
          {scaledIngredients.length === 0 ? (
            <p className="text-gray-500 text-sm">No ingredients listed.</p>
          ) : (
            <ul className="space-y-1">
              {scaledIngredients.map((ing) => {
                const swap = activeSwaps[ing.id];
                const displayName = swap ? swap.toIngredient : ing.name;
                const displayAmount = swap && ing.amount !== null ? ing.amount * swap.ratio : ing.amount;
                const availableSubs = subsByIngredientId[ing.id] ?? [];
                const isOpen = openSwapId === ing.id;

                return (
                  <li key={ing.id} className="flex items-start gap-2 text-sm">
                    <span className="text-gray-400 mt-0.5">-</span>
                    <span className={`flex-1 ${ing.isOptional ? 'text-gray-500' : 'text-gray-900'}`}>
                      {displayAmount !== null
                        ? `${formatScaledAmount(displayAmount)}${ing.unit ? ' ' + ing.unit : ''} `
                        : ''}
                      <span className="font-medium">{displayName}</span>
                      {swap && (
                        <span className="text-xs text-orange-500 ml-1">(sub for {ing.name})</span>
                      )}
                      {!swap && getIngredientAlias(ing.name) && (
                        <span className="text-gray-400 ml-1">({getIngredientAlias(ing.name)})</span>
                      )}
                      {ing.isOptional && (
                        <span className="text-gray-400 ml-1">(optional)</span>
                      )}
                      {availableSubs.length > 0 && (
                        <span className="relative inline-block ml-2 align-middle">
                          <button
                            onClick={() => setOpenSwapId(isOpen ? null : ing.id)}
                            className={`inline-flex items-center justify-center rounded transition-colors ${swap
                              ? 'text-orange-500 hover:text-orange-600'
                              : 'text-gray-400 hover:text-orange-500'
                              }`}
                            aria-label={swap ? `Change substitution for ${ing.name}` : `Substitute ${ing.name}`}
                          >
                            <SwapIcon />
                          </button>
                          {isOpen && (
                            <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-44 py-1">
                              <p className="px-3 pt-1.5 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                                Sub for {ing.name}
                              </p>
                              {availableSubs.map((sub) => (
                                <button
                                  key={sub.id}
                                  onClick={() => {
                                    setActiveSwaps((s) => ({ ...s, [ing.id]: sub }));
                                    setOpenSwapId(null);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-3 hover:bg-gray-50 ${swap?.id === sub.id
                                    ? 'text-orange-600 bg-orange-50'
                                    : 'text-gray-700'
                                    }`}
                                >
                                  <span>{sub.toIngredient}</span>
                                  {sub.ratio !== 1 && (
                                    <span className="text-xs text-gray-400 shrink-0">
                                      {parseFloat(sub.ratio.toPrecision(4))}×
                                    </span>
                                  )}
                                </button>
                              ))}
                              {swap && (
                                <div className="border-t border-gray-100 mt-1 pt-1">
                                  <button
                                    onClick={() => { removeSwap(ing.id); setOpenSwapId(null); }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                  >
                                    Use original
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
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

        {/* Author Notes — shown after ingredients and steps */}
        {recipe.authorNotes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
            <h3 className="text-sm font-medium text-yellow-800 mb-1">Author Notes</h3>
            <p className="text-sm text-yellow-700">{recipe.authorNotes}</p>
          </div>
        )}

        {/* Personal Notes */}
        {recipe.personalNotes && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <h3 className="text-sm font-medium text-blue-800 mb-1">Personal Notes</h3>
            <p className="text-sm text-blue-700">{recipe.personalNotes}</p>
          </div>
        )}

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
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => exportRecipeAsText(recipe, finalIngredients, swapDisplayNames, targetServings)}
              className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-100 px-2.5 py-1 rounded-md transition-colors"
            >
              Export .txt
            </button>
            <button
              onClick={() => exportRecipeAsJson(recipe, finalIngredients, swapDisplayNames, targetServings)}
              className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-100 px-2.5 py-1 rounded-md transition-colors"
            >
              Export JSON
            </button>
            <button
              onClick={() => window.print()}
              className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-100 px-2.5 py-1 rounded-md transition-colors"
            >
              Print
            </button>
          </div>
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
