import { Link, useParams } from 'react-router-dom';
import { useRecipe, useArchiveRecipe } from '../hooks/useRecipes';
import { IngredientList } from '../components/IngredientList';
import { StepList } from '../components/StepList';
import { useScaling, formatScaledAmount } from '../hooks/useScaling';
import { SubstitutionList } from '../components/SubstitutionList';
import type { Recipe } from '../types/recipe';

function handleExport(id: string, format: 'json' | 'text') {
  window.open(`/api/recipes/${id}/export?format=${format}`, '_blank');
}

// Inner component receives the loaded recipe — hooks are safe here.
function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const { id } = useParams<{ id: string }>();
  const archiveMutation = useArchiveRecipe();
  const { targetServings, setTargetServings, scaleIngredient } = useScaling(recipe.servings);
  const scaledIngredients = recipe.ingredients.map(scaleIngredient);

  function handleArchive() {
    if (!id) return;
    archiveMutation.mutate(id);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block">
            &larr; Back to recipes
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{recipe.title}</h1>
          <div className="flex gap-3 text-sm text-gray-500 mt-1">
            {recipe.totalTime && <span>Total: {recipe.totalTime} min</span>}
            {recipe.activeTime && <span>Active: {recipe.activeTime} min</span>}
            <span>{recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {recipe.steps.length > 0 && (
            <Link
              to={`/recipes/${id}/cook`}
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
        </div>
      </div>

      {recipe.archived && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-2 mb-4 text-sm text-amber-700">
          This recipe is archived.
        </div>
      )}

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
        <IngredientList ingredients={scaledIngredients} formatAmount={formatScaledAmount} />
      </div>

      {/* Steps */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Steps</h2>
        <StepList steps={recipe.steps} />
      </div>

      {/* Author Notes — shown after ingredients and steps */}
      {recipe.authorNotes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
          <h3 className="text-sm font-medium text-yellow-800 mb-1">Author Notes</h3>
          <p className="text-sm text-yellow-700">{recipe.authorNotes}</p>
        </div>
      )}

      {/* Substitutions */}
      <SubstitutionList recipeId={id!} />

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
            onClick={() => handleExport(id!, 'text')}
            className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-100 px-2.5 py-1 rounded-md transition-colors"
          >
            Export .txt
          </button>
          <button
            onClick={() => handleExport(id!, 'json')}
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
