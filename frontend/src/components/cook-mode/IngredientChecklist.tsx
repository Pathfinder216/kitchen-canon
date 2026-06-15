import type { Ingredient } from '../../types/recipe';
import { formatScaledAmount } from '../../hooks/useScaling';
import { getIngredientAlias } from '../../utils/ingredientAliases';

interface IngredientChecklistProps {
  ingredients: Ingredient[];
  totalCount: number;
  targetServings: number;
  recipeServings: number;
  checkedIngredients: Set<string>;
  swapDisplayNames: Map<string, string>;
  onToggle: (ingId: string) => void;
}

export function IngredientChecklist({
  ingredients,
  totalCount,
  targetServings,
  recipeServings,
  checkedIngredients,
  swapDisplayNames,
  onToggle,
}: IngredientChecklistProps) {
  return (
    <details className="mt-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
      <summary className="px-5 py-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 select-none">
        Ingredients ({totalCount})
        {targetServings !== recipeServings && (
          <span className="ml-1 text-orange-600 font-normal">· {targetServings} serving{targetServings !== 1 ? 's' : ''}</span>
        )}
      </summary>
      <ul className="divide-y divide-gray-100 px-4 pb-2">
        {ingredients.map((ing) => (
          <li key={ing.id} className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              id={`cook-ing-${ing.id}`}
              checked={checkedIngredients.has(ing.id)}
              onChange={() => onToggle(ing.id)}
              className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
            />
            <label
              htmlFor={`cook-ing-${ing.id}`}
              className={`text-sm cursor-pointer select-none ${checkedIngredients.has(ing.id) ? 'line-through text-gray-400' : 'text-gray-700'}`}
            >
              {ing.amount !== null && (
                <span className="font-medium">
                  {formatScaledAmount(ing.amount)}{' '}
                  {ing.unit}{' '}
                </span>
              )}
              {swapDisplayNames.get(ing.id) ?? ing.name}
              {!swapDisplayNames.has(ing.id) && getIngredientAlias(ing.name) && <span className="text-gray-400 ml-1">({getIngredientAlias(ing.name)})</span>}
              {ing.isOptional && <span className="text-gray-400 ml-1">(optional)</span>}
            </label>
          </li>
        ))}
      </ul>
    </details>
  );
}
