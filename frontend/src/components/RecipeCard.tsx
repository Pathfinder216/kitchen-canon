import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Recipe } from '../types/recipe';
import { formatDuration } from '../utils/formatDuration';

interface MediaItem {
  id: string;
  type: string;
  path: string;
}

async function fetchCoverPhoto(recipeId: string): Promise<MediaItem | null> {
  const res = await fetch(`/api/recipes/${recipeId}/media`);
  if (!res.ok) return null;
  const items: MediaItem[] = await res.json();
  return items.find((m) => m.type === 'image') ?? null;
}

interface RecipeCardProps {
  recipe: Recipe;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const { data: cover = null } = useQuery({
    queryKey: ['cover-photo', recipe.id],
    queryFn: () => fetchCoverPhoto(recipe.id),
    staleTime: 60_000,
  });

  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="flex items-center gap-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-shadow"
    >
      {/* Cover photo thumbnail */}
      <div className="w-16 h-16 shrink-0 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
        {cover ? (
          <img src={cover.path} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl opacity-30">🍽</span>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-gray-900 truncate">{recipe.title}</h3>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-gray-500 mt-0.5">
          {recipe.totalTime && <span>{formatDuration(recipe.totalTime)}</span>}
          <span>{recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</span>
          <span>{recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}</span>
        </div>
        {recipe.source && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{recipe.source}</p>
        )}
      </div>
    </Link>
  );
}
