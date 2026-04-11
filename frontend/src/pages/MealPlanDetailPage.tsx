import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GroceryList } from '../components/GroceryList';
import { useMealPlan, useToggleGroceryItem } from '../hooks/useMealPlans';

interface MediaItem { id: string; type: string; path: string; }

async function fetchCoverPhoto(recipeId: string): Promise<MediaItem | null> {
  const res = await fetch(`/api/recipes/${recipeId}/media`);
  if (!res.ok) return null;
  const items: MediaItem[] = await res.json();
  return items.find((m) => m.type === 'image') ?? null;
}

function MealRecipeRow({ mr, planId }: {
  mr: { id: string; recipeId: string; servings: number; recipeVersion: number; substitutions: Record<string, { toIngredient: string; ratio: number }> | null; recipe: { title: string } };
  planId: string;
}) {
  const { data: cover = null } = useQuery({
    queryKey: ['cover-photo', mr.recipeId],
    queryFn: () => fetchCoverPhoto(mr.recipeId),
    staleTime: 60_000,
  });

  return (
    <li className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
        {cover
          ? <img src={cover.path} alt="" className="w-full h-full object-cover" />
          : <span className="text-base opacity-30">🍽</span>
        }
      </div>
      <div className="flex-1">
        <Link
          to={`/recipes/${mr.recipeId}`}
          state={{ from: { label: 'Back to meal', href: `/meal-plans/${planId}` } }}
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
        state={{
          from: { label: 'Back to meal plan', href: `/meal-plans/${planId}` },
          targetServings: mr.servings,
          activeSwaps: mr.substitutions ?? undefined,
        }}
        className="text-sm text-orange-600 hover:text-orange-800 font-medium"
      >
        Cook →
      </Link>
    </li>
  );
}

function formatDate(iso: string) {
  // iso is "YYYY-MM-DD"; append T12:00 to avoid timezone shifting to previous day
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(time: string) {
  const [hourStr, minuteStr] = time.split(':');
  const hour = parseInt(hourStr, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minuteStr} ${period}`;
}

function formatCreatedAt(iso: string) {
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

  if (isLoading) return <p className="text-gray-500">Loading meal plan…</p>;
  if (error || !plan) return <p className="text-red-600">Meal plan not found.</p>;

  const totalPurchased = plan.groceryList.filter((i) => i.purchased).length;
  const progress = plan.groceryList.length > 0
    ? Math.round((totalPurchased / plan.groceryList.length) * 100)
    : 0;

  function handleRemake() {
    // Navigate to the creation form with this plan pre-filled (date intentionally omitted)
    navigate('/meal-plans/new', {
      state: {
        remakeFrom: {
          name: plan!.name,
          // date omitted so user must pick a new one
          time: plan!.time,
          notes: plan!.notes,
          recipes: plan!.recipes,
        },
      },
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/meal-plans" className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block">
            ← Back to meal plans
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {plan.name ?? 'Meal Plan'}
          </h1>
          {/* Date / time */}
          {plan.date && (
            <p className="text-sm text-gray-700 mt-1 font-medium">
              {formatDate(plan.date)}{plan.time && ` at ${formatTime(plan.time)}`}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">Created {formatCreatedAt(plan.createdAt)}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            to={`/meal-plans/${id}/edit`}
            className="border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={handleRemake}
            className="border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Remake
          </button>
        </div>
      </div>

      {/* Notes */}
      {plan.notes && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.notes}</p>
        </section>
      )}

      {/* Recipes */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recipes</h2>
        <ul className="space-y-2">
          {plan.recipes.map((mr) => (
            <MealRecipeRow key={mr.id} mr={mr} planId={id!} />
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
