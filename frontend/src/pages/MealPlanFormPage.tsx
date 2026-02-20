import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RecipeSelector, type SelectedRecipe } from '../components/RecipeSelector';
import { useCreateMealPlan } from '../hooks/useMealPlans';

export function MealPlanFormPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<SelectedRecipe[]>([]);
  const [error, setError] = useState<string | null>(null);
  const createMealPlan = useCreateMealPlan();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) {
      setError('Please select at least one recipe.');
      return;
    }
    setError(null);
    try {
      const mealPlan = await createMealPlan.mutateAsync({
        name: name.trim() || undefined,
        recipes: selected.map((s, index) => ({
          recipeId: s.recipeId,
          servings: s.servings,
          orderIndex: index,
        })),
      });
      navigate(`/meal-plans/${mealPlan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meal plan');
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Meal Plan</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="plan-name" className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="plan-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. This week's meals"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">Recipes</p>
          <RecipeSelector selected={selected} onChange={setSelected} />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={createMealPlan.isPending}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
          >
            {createMealPlan.isPending ? 'Creating...' : 'Create Meal Plan'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/meal-plans')}
            className="border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium px-5 py-2 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
