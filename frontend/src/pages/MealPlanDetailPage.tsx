import { Link, useNavigate, useParams } from 'react-router-dom';
import { GroceryList } from '../components/GroceryList';
import { useMealPlan, useRemakeMealPlan, useToggleGroceryItem } from '../hooks/useMealPlans';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function MealPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: plan, isLoading, error } = useMealPlan(id!);
  const toggleItem = useToggleGroceryItem(id!);
  const remake = useRemakeMealPlan();

  if (isLoading) return <p className="text-gray-500">Loading meal plan...</p>;
  if (error || !plan) return <p className="text-red-600">Meal plan not found.</p>;

  const totalPurchased = plan.groceryList.filter((i) => i.purchased).length;
  const progress = plan.groceryList.length > 0
    ? Math.round((totalPurchased / plan.groceryList.length) * 100)
    : 0;

  async function handleRemake() {
    const newPlan = await remake.mutateAsync(id!);
    navigate(`/meal-plans/${newPlan.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {plan.name ?? 'Meal Plan'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{formatDate(plan.createdAt)}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleRemake}
            disabled={remake.isPending}
            className="border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-60 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            {remake.isPending ? 'Remaking...' : 'Remake'}
          </button>
          <Link
            to="/meal-plans"
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
          >
            ← Back
          </Link>
        </div>
      </div>

      {/* Recipes */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recipes</h2>
        <ul className="space-y-2">
          {plan.recipes.map((mr) => (
            <li key={mr.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex-1">
                <Link
                  to={`/recipes/${mr.recipeId}`}
                  className="font-medium text-gray-900 hover:text-orange-600 transition-colors"
                >
                  {mr.recipe.title}
                </Link>
                <p className="text-xs text-gray-500 mt-0.5">
                  {mr.servings} servings
                  {mr.recipeVersion > 1 && ` · v${mr.recipeVersion}`}
                </p>
              </div>
              <Link
                to={`/recipes/${mr.recipeId}/cook`}
                className="text-sm text-orange-600 hover:text-orange-800 font-medium"
              >
                Cook →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Grocery list */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Grocery List</h2>
          {plan.groceryList.length > 0 && (
            <span className="text-sm text-gray-500">
              {totalPurchased}/{plan.groceryList.length} · {progress}%
            </span>
          )}
        </div>

        {/* Progress bar */}
        {plan.groceryList.length > 0 && (
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
            <div
              className="bg-orange-500 h-1.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <GroceryList
            items={plan.groceryList}
            onToggle={(itemId, purchased) =>
              toggleItem.mutate({ itemId, purchased })
            }
          />
        </div>
      </section>
    </div>
  );
}
