import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRecipe, useCreateRecipe, useUpdateRecipe } from '../hooks/useRecipes';
import { RecipeForm } from '../components/RecipeForm';
import type { PendingMedia } from '../components/RecipeForm';
import type { CreateRecipeInput } from '../types/recipe';
import type { ParsedRecipe } from '../api/import';
import { assignCourses, assignLabels } from '../api/labels';
import { apiGet } from '../api/client';
import type { DietaryInfo } from '../types/meal-plan';

async function uploadCoverPhoto(recipeId: string, file: File): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  await fetch(`/api/recipes/${recipeId}/media`, { method: 'POST', body: form });
}

async function uploadStepMedia(stepId: string, file: File): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  await fetch(`/api/steps/${stepId}/media`, { method: 'POST', body: form });
}

export function RecipeFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = !!id;

  const importData = (location.state as { importData?: ParsedRecipe } | null)?.importData;

  const { data: recipe, isLoading } = useRecipe(id);
  const createMutation = useCreateRecipe();
  const updateMutation = useUpdateRecipe();

  const { data: dietaryInfo } = useQuery<DietaryInfo>({
    queryKey: ['recipe-dietary', id],
    queryFn: () => apiGet(`/recipes/${id}/dietary-info`),
    enabled: isEditing && !!id,
    staleTime: 5 * 60 * 1000,
  });

  async function handleSubmit(data: CreateRecipeInput, media: PendingMedia, courseTypes: string[], labelIds: string[]) {
    if (isEditing && id) {
      updateMutation.mutate(
        { id, input: data },
        {
          onSuccess: async (updated) => {
            const uploads = media.stepMedia.flatMap(({ orderIndex, file }) => {
              const step = updated.steps.find(s => s.orderIndex === orderIndex);
              return step ? [uploadStepMedia(step.id, file)] : [];
            });
            await Promise.all([
              ...uploads,
              assignCourses(updated.id, courseTypes),
              assignLabels(updated.id, labelIds),
            ]);
            navigate(`/recipes/${updated.id}`);
          },
        },
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: async (created) => {
          const uploads: Promise<void>[] = [];
          if (media.coverPhoto) uploads.push(uploadCoverPhoto(created.id, media.coverPhoto));
          for (const { orderIndex, file } of media.stepMedia) {
            const step = created.steps.find(s => s.orderIndex === orderIndex);
            if (step) uploads.push(uploadStepMedia(step.id, file));
          }
          await Promise.all([
            ...uploads,
            assignCourses(created.id, courseTypes),
            assignLabels(created.id, labelIds),
          ]);
          navigate(`/recipes/${created.id}`);
        },
      });
    }
  }

  if (isEditing && isLoading) {
    return <p className="text-gray-500">Loading recipe...</p>;
  }

  const unknownIngredients = dietaryInfo?.unknownIngredients ?? [];

  return (
    <div>
      <Link to={isEditing ? `/recipes/${id}` : '/'} className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        &larr; {isEditing ? 'Back to recipe' : 'Back to recipes'}
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEditing ? 'Edit Recipe' : 'New Recipe'}
      </h1>

      {isEditing && unknownIngredients.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6 space-y-1">
          <p className="text-xs text-amber-800">
            {unknownIngredients.length} ingredient{unknownIngredients.length > 1 ? 's' : ''} not in catalog — dietary info may be incomplete.
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {unknownIngredients.map((name) => (
              <a
                key={name}
                href={`#ing-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                className="text-xs font-medium text-amber-700 hover:text-amber-900 underline"
              >
                {name}
              </a>
            ))}
          </div>
        </div>
      )}

      <RecipeForm
        initialData={recipe}
        importData={importData}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        recipeId={id}
      />
    </div>
  );
}
