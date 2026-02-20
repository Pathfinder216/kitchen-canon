import { Link } from 'react-router-dom';
import type { Recipe } from '../types/recipe';

interface RecipeCardProps {
  recipe: Recipe;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="block bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{recipe.title}</h3>
      <div className="flex gap-3 text-sm text-gray-500">
        {recipe.totalTime && (
          <span>{recipe.totalTime} min</span>
        )}
        <span>{recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</span>
        <span>{recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}</span>
      </div>
      {recipe.source && (
        <p className="text-xs text-gray-400 mt-2 truncate">{recipe.source}</p>
      )}
    </Link>
  );
}
