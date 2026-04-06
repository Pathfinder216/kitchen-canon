import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useRecipe, useArchiveRecipe, useDeleteRecipePermanently } from '../hooks/useRecipes';
import { IngredientList } from '../components/IngredientList';
import { useScaling, formatScaledAmount } from '../hooks/useScaling';
import { SubstitutionList } from '../components/SubstitutionList';
import { RecipeMedia } from '../components/RecipeMedia';
import { StepMedia } from '../components/StepMedia';
import type { Recipe } from '../types/recipe';
import { COURSE_DISPLAY_NAMES } from '../api/courses';

function handleExport(id: string, format: 'json' | 'text') {
  window.open(`/api/recipes/${id}/export?format=${format}`, '_blank');
}

// Inner component receives the loaded recipe — hooks are safe here.
function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const backLink = (location.state as { from?: { label: string; href: string } } | null)?.from ?? { label: 'Back to recipes', href: '/' };
  const archiveMutation = useArchiveRecipe();
  const deleteMutation = useDeleteRecipePermanently();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { targetServings, setTargetServings, scaleIngredient } = useScaling(recipe.servings);
  const scaledIngredients = recipe.ingredients.map(scaleIngredient);

  function handleArchive() {
    if (!id) return;
    archiveMutation.mutate(id);
  }

  function handleDelete() {
    if (!id) return;
    deleteMutation.mutate(id);
  }

  return (
    <div>
      {/* Print layout — only visible when printing */}
      <div className="hidden print:block text-black">
        <h1 className="text-2xl font-bold mb-1">{recipe.title}</h1>
        <div className="flex gap-4 text-sm text-gray-600 mb-1">
          {recipe.totalTime && <span>Total: {recipe.totalTime} min</span>}
          {recipe.activeTime && <span>Active: {recipe.activeTime} min</span>}
          <span>{recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</span>
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
          {recipe.ingredients.map((ing) => (
            <li key={ing.id}>
              {ing.amount !== null && (
                <span className="font-medium">
                  {formatScaledAmount(ing.amount)}{' '}
                  {ing.unit}{' '}
                </span>
              )}
              {ing.name}
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
                {step.instruction}
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
        {(recipe.courses.length > 0 || recipe.labels.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {recipe.courses.map((rc) => (
              <span key={rc.courseType} className="px-2.5 py-0.5 text-xs rounded-full bg-blue-50 border border-blue-200 text-blue-700">
                {COURSE_DISPLAY_NAMES[rc.courseType] ?? rc.courseType}
              </span>
            ))}
            {recipe.labels.map((rl) => (
              <span key={rl.labelId} title={rl.label.type} className="px-2.5 py-0.5 text-xs rounded-full bg-gray-100 border border-gray-200 text-gray-600">
                {rl.label.name}
              </span>
            ))}
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
          <IngredientList ingredients={scaledIngredients} formatAmount={formatScaledAmount} />
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
                    <p className="text-gray-900 text-sm">{step.instruction}</p>
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
