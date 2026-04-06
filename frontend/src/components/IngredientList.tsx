import type { Ingredient } from '../types/recipe';
import { getIngredientAlias } from '../utils/ingredientAliases';

interface IngredientListProps {
  ingredients: Ingredient[];
  formatAmount?: (amount: number | null) => string;
}


export function IngredientList({ ingredients, formatAmount: customFormatAmount }: IngredientListProps) {
  const fmtAmount = customFormatAmount ?? ((amount: number | null) => {
    if (amount === null) return '';
    return amount % 1 === 0 ? amount.toString() : amount.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  });
  if (ingredients.length === 0) {
    return <p className="text-gray-500 text-sm">No ingredients listed.</p>;
  }

  return (
    <ul className="space-y-1">
      {ingredients.map((ingredient) => (
        <li key={ingredient.id} className="flex items-start gap-2 text-sm">
          <span className="text-gray-400 mt-0.5">-</span>
          <span className={ingredient.isOptional ? 'text-gray-500' : 'text-gray-900'}>
            {ingredient.amount !== null ? `${fmtAmount(ingredient.amount)}${ingredient.unit ? ' ' + ingredient.unit : ''} ` : ''}
            <span className="font-medium">{ingredient.name}</span>
            {(() => {
              const alias = getIngredientAlias(ingredient.name);
              return alias ? <span className="text-gray-400 ml-1">({alias})</span> : null;
            })()}
            {ingredient.isOptional && (
              <span className="text-gray-400 ml-1">(optional)</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
