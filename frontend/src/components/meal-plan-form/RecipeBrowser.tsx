import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRecipes } from '../../hooks/useRecipes';
import { FilterPanel } from '../FilterPanel';
import { fetchCoverPhoto } from './types';
import { formatDuration } from '../../utils/formatDuration';
import type { Recipe } from '../../types/recipe';

const base = 'rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500';

interface RecipeFilters {
  includeIngredients?: string;
  excludeIngredients?: string;
  labels?: string;
  diets?: string;
  freeFrom?: string;
  courses?: string;
}

interface BrowserRecipeCardProps {
  recipe: Recipe;
  isAdded: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onView: () => void;
}

function BrowserRecipeCard({ recipe, isAdded, onAdd, onRemove, onView }: BrowserRecipeCardProps) {
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
          {recipe.totalTime && <span>{formatDuration(recipe.totalTime)}</span>}
          <span>{recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</span>
          <span>{recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}</span>
        </div>
      </button>

      {/* Add button */}
      <button
        type="button"
        onClick={isAdded ? onRemove : onAdd}
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 ${
          isAdded
            ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
            : 'bg-orange-500 text-white hover:bg-orange-600'
        }`}
        aria-label={isAdded ? `Remove ${recipe.title}` : `Add ${recipe.title}`}
      >
        {isAdded ? '✓' : '+'}
      </button>
    </div>
  );
}

interface RecipeBrowserProps {
  selectedIds: Set<string>;
  onAdd: (recipe: Recipe) => void;
  onRemove: (recipeId: string) => void;
  onView: (recipeId: string) => void;
}

/** The left-hand "Browse Recipes" panel: search box, FilterPanel (dietary/allergen/label/course
 *  filters served from useDietaryTags via FilterPanel), the candidate-recipe grid, and pagination.
 *  All filtering is server-side through the recipe query. */
export function RecipeBrowser({ selectedIds, onAdd, onRemove, onView }: RecipeBrowserProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<RecipeFilters>({});

  const { data: recipesData, isLoading: recipesLoading } = useRecipes({
    search: search || undefined,
    page,
    ...filters,
  });

  return (
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
                onAdd={() => onAdd(recipe)}
                onRemove={() => onRemove(recipe.id)}
                onView={() => onView(recipe.id)}
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
  );
}
