import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../api/client';
import type { Recipe } from '../../types/recipe';
import type { ActiveSwaps } from '../../types/meal-plan';
import { resolveIngredientRefs } from '../../utils/resolveIngredientRefs';
import { formatDuration } from '../../utils/formatDuration';
import { fetchSubstitutionsForRecipe, type Substitution } from '../../api/substitutions';
import { Modal } from '../ui/Modal';
import { Menu, MenuItemButton, MenuItem } from '../ui/Menu';
import { NumberField } from '../ui/NumberField';
import { SwapIcon } from './SwapIcon';
import { parseServings } from './types';

interface RecipePreviewModalProps {
  recipeId: string;
  isAdded: boolean;
  /** Empty-able servings string from the selected-recipe state, or undefined when not yet added. */
  currentServings: string | undefined;
  currentSwaps: ActiveSwaps;
  onAddOrUpdate: (recipeId: string, title: string, defaultServings: number, servings: number, activeSwaps: ActiveSwaps) => void;
  onClose: () => void;
}

export function RecipePreviewModal({ recipeId, isAdded, currentServings, currentSwaps, onAddOrUpdate, onClose }: RecipePreviewModalProps) {
  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => apiGet<Recipe>(`/recipes/${recipeId}`),
    staleTime: 60_000,
  });

  const { data: substitutions = [] } = useQuery({
    queryKey: ['recipe-substitutions', recipeId],
    queryFn: () => fetchSubstitutionsForRecipe(recipeId),
    staleTime: 60_000,
  });

  const [servings, setServings] = useState(currentServings ?? '1');
  const [activeSwaps, setActiveSwaps] = useState<ActiveSwaps>(currentSwaps);

  useEffect(() => {
    if (recipe) setServings(currentServings ?? String(recipe.servings));
  }, [recipe, currentServings]);

  // Group substitutions by ingredient name
  const subsByName = new Map<string, Substitution[]>();
  for (const sub of substitutions) {
    const list = subsByName.get(sub.fromIngredient) ?? [];
    list.push(sub);
    subsByName.set(sub.fromIngredient, list);
  }

  function toggleSwap(ingId: string, sub: Substitution) {
    setActiveSwaps((prev) => {
      if (prev[ingId]?.toIngredient === sub.toIngredient) {
        const next = { ...prev };
        delete next[ingId];
        return next;
      }
      return { ...prev, [ingId]: { toIngredient: sub.toIngredient, ratio: sub.ratio } };
    });
  }

  const swapCount = Object.keys(activeSwaps).length;

  return (
    <Modal
      open
      onClose={onClose}
      panelClassName="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl"
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
                {recipe.totalTime && <span>{formatDuration(recipe.totalTime)} total</span>}
                {recipe.activeTime && <span>{formatDuration(recipe.activeTime)} active</span>}
                <span>{recipe.servings} default servings</span>
                {recipe.source && <span className="truncate">{recipe.source}</span>}
              </div>

              {/* Active swap chips */}
              {swapCount > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(activeSwaps).map(([ingId, swap]) => {
                    const ing = recipe.ingredients.find((i) => i.id === ingId);
                    if (!ing) return null;
                    return (
                      <button
                        key={ingId}
                        type="button"
                        onClick={() => {
                          setActiveSwaps((prev) => {
                            const next = { ...prev };
                            delete next[ingId];
                            return next;
                          });
                        }}
                        className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 border border-orange-300 rounded-full px-2 py-0.5 hover:bg-orange-200 transition-colors"
                        title="Click to remove substitution"
                      >
                        <SwapIcon />
                        {ing.name} → {swap.toIngredient}
                        <span className="ml-0.5 text-orange-500">✕</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Ingredients */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Ingredients ({recipe.ingredients.length})
                </h3>
                <ul className="space-y-1">
                  {recipe.ingredients.map((ing) => {
                    const swap = activeSwaps[ing.id];
                    const displayName = swap ? swap.toIngredient : ing.name;
                    const subs = subsByName.get(ing.name) ?? [];
                    return (
                      <li key={ing.id} className="text-sm text-gray-700 flex gap-2 items-center">
                        <span className="text-gray-400 shrink-0">
                          {ing.amount != null ? `${ing.amount}${ing.unit ? ' ' + ing.unit : ''}` : ing.unit ?? ''}
                        </span>
                        <span className={swap ? 'text-orange-700 font-medium' : ''}>
                          {displayName}
                          {ing.isOptional && <span className="text-gray-400 ml-1">(optional)</span>}
                          {swap && <span className="text-gray-400 font-normal ml-1">(was {ing.name})</span>}
                        </span>
                        {subs.length > 0 && (
                          <span className="inline-block ml-1">
                            <Menu
                              buttonAriaLabel={`Substitute ${ing.name}`}
                              buttonClassName={`p-0.5 rounded transition-colors ${swap ? 'text-orange-500 hover:text-orange-700' : 'text-gray-400 hover:text-orange-500'}`}
                              className="min-w-[180px]"
                              label={<SwapIcon />}
                            >
                              <p className="text-xs text-gray-400 px-3 py-1 font-medium">Substitute {ing.name}</p>
                              {subs.map((sub) => {
                                const isActive = activeSwaps[ing.id]?.toIngredient === sub.toIngredient;
                                return (
                                  <MenuItemButton
                                    key={sub.id}
                                    selected={isActive}
                                    onClick={() => toggleSwap(ing.id, sub)}
                                  >
                                    {isActive ? '✓ ' : ''}{sub.toIngredient}
                                    {sub.ratio !== 1 && (
                                      <span className="text-xs text-gray-400 ml-1">({sub.ratio}× amount)</span>
                                    )}
                                  </MenuItemButton>
                                );
                              })}
                              {swap && (
                                <MenuItem>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveSwaps((prev) => { const next = { ...prev }; delete next[ing.id]; return next; })
                                    }
                                    className="block w-full text-left px-3 py-2 text-sm text-red-500 border-t border-gray-100 data-[focus]:bg-red-50"
                                  >
                                    Remove substitution
                                  </button>
                                </MenuItem>
                              )}
                            </Menu>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Steps */}
              {recipe.steps.length > 0 && (() => {
                // Apply swap ratios to amounts (same pattern as RecipeDetailPage)
                const finalIngredients = recipe.ingredients.map((ing) => {
                  const swap = activeSwaps[ing.id];
                  if (!swap) return ing;
                  return { ...ing, amount: ing.amount !== null ? ing.amount * swap.ratio : null };
                });
                const swapDisplayNames = new Map(
                  Object.entries(activeSwaps).map(([id, s]) => [id, s.toIngredient])
                );
                return (
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
                          <span>{resolveIngredientRefs(step.instruction, finalIngredients, 1, swapDisplayNames)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* Footer — add/update */}
        <div className="border-t border-gray-200 px-5 py-4 flex items-center gap-4">
          <label htmlFor="modal-servings" className="text-sm text-gray-700 shrink-0">Servings:</label>
          <NumberField
            id="modal-servings"
            min={1}
            value={servings}
            onChange={setServings}
            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            type="button"
            disabled={!recipe}
            onClick={() => {
              if (recipe) {
                onAddOrUpdate(recipe.id, recipe.title, recipe.servings, parseServings(servings, recipe.servings), activeSwaps);
                onClose();
              }
            }}
            className="ml-auto bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {isAdded ? 'Update' : 'Add to Meal'}
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
    </Modal>
  );
}
