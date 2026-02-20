import { Link } from 'react-router-dom';
import { useMealPlans } from '../hooks/useMealPlans';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function MealHistoryPage() {
  const { data: plans, isLoading } = useMealPlans();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meal Plans</h1>
        <Link
          to="/meal-plans/new"
          className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + New Plan
        </Link>
      </div>

      {isLoading && <p className="text-gray-500">Loading...</p>}

      {(!plans || plans.length === 0) && !isLoading && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="text-lg font-medium">No meal plans yet</p>
          <p className="text-sm mt-1">Create your first plan to get a grocery list.</p>
          <Link
            to="/meal-plans/new"
            className="inline-block mt-4 bg-orange-500 hover:bg-orange-600 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
          >
            Create Plan
          </Link>
        </div>
      )}

      {plans && plans.length > 0 && (
        <ul className="space-y-3">
          {plans.map((plan) => (
            <li key={plan.id}>
              <Link
                to={`/meal-plans/${plan.id}`}
                className="block bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-orange-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {plan.name ?? 'Meal Plan'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(plan.createdAt)}</p>
                  </div>
                  <span className="text-sm text-gray-500">
                    {plan.recipes.length} recipe{plan.recipes.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {plan.recipes.length > 0 && (
                  <p className="text-sm text-gray-600 mt-2 truncate">
                    {plan.recipes.map((r) => r.recipe.title).join(' · ')}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
