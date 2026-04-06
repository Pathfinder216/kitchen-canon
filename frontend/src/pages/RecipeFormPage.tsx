import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useRecipe, useCreateRecipe, useUpdateRecipe } from '../hooks/useRecipes';
import { RecipeForm } from '../components/RecipeForm';
import type { PendingMedia } from '../components/RecipeForm';
import type { CreateRecipeInput } from '../types/recipe';
import type { ParsedRecipe } from '../api/import';
import { assignCourses, assignLabels } from '../api/labels';

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
        recipeId={id}
      />
    </div>
  );
}
