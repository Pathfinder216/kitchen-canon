import { Link, useNavigate, useParams } from 'react-router-dom';
import { useRecipeVersions, useRestoreRecipeVersion } from '../hooks/useRecipes';

export function RecipeVersionHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: versions, isLoading, error } = useRecipeVersions(id);
  const restoreMutation = useRestoreRecipeVersion();

  if (isLoading) return <p className="text-gray-500">Loading versions...</p>;
  if (error || !versions) return <p className="text-red-600">Failed to load version history.</p>;

  return (
    <div className="max-w-2xl">
      <Link to={`/recipes/${id}`} className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
        &larr; Back to recipe
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Version History</h1>

      {versions.length === 0 && (
        <p className="text-gray-500">No version history available.</p>
      )}

      <div className="space-y-3">
        {versions.map((v) => (
          <div
            key={v.id}
            className={`border rounded-xl px-5 py-4 ${v.isLatest ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-gray-900">Version {v.version}</span>
                  {v.isLatest && (
                    <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full shrink-0">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(v.updatedAt).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {v.ingredients.length} ingredient{v.ingredients.length !== 1 ? 's' : ''} &middot;{' '}
                  {v.steps.length} step{v.steps.length !== 1 ? 's' : ''}
                </p>
              </div>
              {!v.isLatest && (
                <button
                  onClick={() =>
                    restoreMutation.mutate(
                      { id: id!, version: v.version },
                      { onSuccess: (restored) => navigate(`/recipes/${restored.id}`) },
                    )
                  }
                  disabled={restoreMutation.isPending}
                  className="shrink-0 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Restore
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
