import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCoverPhoto } from './types';
import type { SelectedRecipe } from './types';
import { SwapIcon } from './SwapIcon';

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

interface SelectedRecipesListProps {
  selected: SelectedRecipe[];
  onRemove: (recipeId: string) => void;
  onUpdateServings: (recipeId: string, value: number) => void;
}

/** The right-hand "Meal" panel: chosen recipes with servings inputs + active-substitution chips. */
export function SelectedRecipesList({ selected, onRemove, onUpdateServings }: SelectedRecipesListProps) {
  return (
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
                      onClick={() => onRemove(s.recipeId)}
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
                      onChange={(e) => onUpdateServings(s.recipeId, Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 border border-orange-300 rounded px-2 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                    <span className="text-xs text-gray-400">(default: {s.defaultServings})</span>
                  </div>
                  {Object.keys(s.activeSwaps).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(s.activeSwaps).map(([, swap]) => (
                        <span
                          key={swap.toIngredient}
                          className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5"
                        >
                          <SwapIcon />
                          {swap.toIngredient}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
