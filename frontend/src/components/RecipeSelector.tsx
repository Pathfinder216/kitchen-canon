import { useState } from 'react';
import { useRecipes } from '../hooks/useRecipes';
import type { Recipe } from '../types/recipe';

export interface SelectedRecipe {
  recipeId: string;
  title: string;
  defaultServings: number;
  servings: number;
}

interface RecipeSelectorProps {
  selected: SelectedRecipe[];
  onChange: (selected: SelectedRecipe[]) => void;
}

export function RecipeSelector({ selected, onChange }: RecipeSelectorProps) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useRecipes({ search: search || undefined, limit: 20 });

  const selectedIds = new Set(selected.map((s) => s.recipeId));

  function toggleRecipe(recipe: Recipe) {
    if (selectedIds.has(recipe.id)) {
      onChange(selected.filter((s) => s.recipeId !== recipe.id));
    } else {
      onChange([
        ...selected,
        {
          recipeId: recipe.id,
          title: recipe.title,
          defaultServings: recipe.servings,
          servings: recipe.servings,
        },
      ]);
    }
  }

  function updateServings(recipeId: string, servings: number) {
    onChange(
      selected.map((s) => (s.recipeId === recipeId ? { ...s, servings } : s)),
    );
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...selected];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  }

  function moveDown(index: number) {
    if (index === selected.length - 1) return;
    const next = [...selected];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <label htmlFor="recipe-search" className="block text-sm font-medium text-gray-700 mb-1">
          Search recipes
        </label>
        <input
          id="recipe-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type to filter..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* Recipe list */}
      {isLoading ? (
        <p className="text-gray-500 text-sm">Loading recipes...</p>
      ) : (
        <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
          {data?.recipes.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">No recipes found.</li>
          )}
          {data?.recipes.map((recipe) => (
            <li key={recipe.id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50">
              <input
                type="checkbox"
                id={`select-${recipe.id}`}
                checked={selectedIds.has(recipe.id)}
                onChange={() => toggleRecipe(recipe)}
                className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
              />
              <label htmlFor={`select-${recipe.id}`} className="flex-1 text-sm cursor-pointer">
                {recipe.title}
                <span className="ml-2 text-xs text-gray-400">
                  (default: {recipe.servings} servings)
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {/* Selected recipes with servings control */}
      {selected.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Selected ({selected.length})
          </h3>
          <ul className="space-y-2">
            {selected.map((s, index) => (
              <li key={s.recipeId} className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                <div className="flex flex-col gap-0.5 mr-1">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    aria-label="Move up"
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === selected.length - 1}
                    aria-label="Move down"
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none"
                  >
                    ▼
                  </button>
                </div>
                <span className="flex-1 text-sm font-medium text-gray-800">{s.title}</span>
                <label htmlFor={`servings-${s.recipeId}`} className="text-xs text-gray-600">
                  Servings:
                </label>
                <input
                  id={`servings-${s.recipeId}`}
                  type="number"
                  min={1}
                  max={100}
                  value={s.servings}
                  onChange={(e) => updateServings(s.recipeId, Number(e.target.value))}
                  className="w-16 border border-orange-300 rounded px-2 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-400"
                />
                <button
                  type="button"
                  onClick={() => toggleRecipe({ id: s.recipeId } as Recipe)}
                  aria-label={`Remove ${s.title}`}
                  className="text-gray-400 hover:text-red-500 text-sm font-bold ml-1"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
