import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useRecipe, useCreateRecipe, useUpdateRecipe } from '../hooks/useRecipes';
import { RecipeForm } from '../components/RecipeForm';
import { RecipeMedia } from '../components/RecipeMedia';
import type { CreateRecipeInput } from '../types/recipe';
import type { ParsedRecipe } from '../api/import';

export function RecipeFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = !!id;

  const importData = (location.state as { importData?: ParsedRecipe } | null)?.importData;

  const { data: recipe, isLoading } = useRecipe(id);
  const createMutation = useCreateRecipe();
  const updateMutation = useUpdateRecipe();

  function handleSubmit(data: CreateRecipeInput) {
    if (isEditing && id) {
      updateMutation.mutate(
        { id, input: data },
        { onSuccess: (updated) => navigate(`/recipes/${updated.id}`) },
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: (created) => navigate(`/recipes/${created.id}`),
      });
    }
  }

  if (isEditing && isLoading) {
    return <p className="text-gray-500">Loading recipe...</p>;
  }

  return (
    <div>
      <Link to={isEditing ? `/recipes/${id}` : '/'} className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        &larr; {isEditing ? 'Back to recipe' : 'Back to recipes'}
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEditing ? 'Edit Recipe' : 'New Recipe'}
      </h1>
      <RecipeForm
        initialData={recipe}
        importData={importData}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
      {isEditing && id && (
        <div className="mt-8 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Photos</h2>
          <RecipeMedia recipeId={id} />
        </div>
      )}
    </div>
  );
}
