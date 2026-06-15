import { formatScaledAmount } from '../../hooks/useScaling';
import { getIngredientAlias } from '../../utils/ingredientAliases';
import { SubstitutionsMenu } from './SubstitutionsMenu';
import type { Ingredient } from '../../types/recipe';
import type { Substitution } from '../../api/substitutions';

interface RecipeIngredientListProps {
  /** The recipe's original ingredients (for swap-chip labels). */
  ingredients: Ingredient[];
  /** Scaled (but not swap-adjusted) ingredients — swap ratio is applied here for display. */
  scaledIngredients: Ingredient[];
  activeSwaps: Record<string, Substitution>;
  subsByIngredientId: Record<string, Substitution[]>;
  onApplySwap: (ingId: string, sub: Substitution) => void;
  onRemoveSwap: (ingId: string) => void;
  onClearSwaps: () => void;
}

/** Active-swap chips + the ingredient list with per-row substitution menus. */
export function RecipeIngredientList({
  ingredients,
  scaledIngredients,
  activeSwaps,
  subsByIngredientId,
  onApplySwap,
  onRemoveSwap,
  onClearSwaps,
}: RecipeIngredientListProps) {
  return (
    <>
      {/* Active swap chips */}
      {Object.keys(activeSwaps).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(activeSwaps).map(([ingId, swap]) => {
            const originalIng = ingredients.find((i) => i.id === ingId);
            if (!originalIng) return null;
            return (
              <span key={ingId} className="inline-flex items-center gap-1 text-xs bg-orange-50 border border-orange-200 text-orange-700 px-2 py-0.5 rounded-full">
                {originalIng.name} → {swap.toIngredient}
                <button
                  onClick={() => onRemoveSwap(ingId)}
                  className="text-orange-400 hover:text-orange-600 ml-0.5 leading-none"
                  aria-label={`Remove substitution for ${originalIng.name}`}
                >
                  ×
                </button>
              </span>
            );
          })}
          {Object.keys(activeSwaps).length > 1 && (
            <button
              onClick={onClearSwaps}
              className="text-xs text-gray-400 hover:text-gray-600 px-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Ingredient list with swap buttons */}
      {scaledIngredients.length === 0 ? (
        <p className="text-gray-500 text-sm">No ingredients listed.</p>
      ) : (
        <ul className="space-y-1">
          {scaledIngredients.map((ing) => {
            const swap = activeSwaps[ing.id];
            const displayName = swap ? swap.toIngredient : ing.name;
            const displayAmount = swap && ing.amount !== null ? ing.amount * swap.ratio : ing.amount;
            const availableSubs = subsByIngredientId[ing.id] ?? [];

            return (
              <li key={ing.id} className="flex items-start gap-2 text-sm">
                <span className="text-gray-400 mt-0.5">-</span>
                <span className={`flex-1 ${ing.isOptional ? 'text-gray-500' : 'text-gray-900'}`}>
                  {displayAmount !== null
                    ? `${formatScaledAmount(displayAmount)}${ing.unit ? ' ' + ing.unit : ''} `
                    : ''}
                  <span className="font-medium">{displayName}</span>
                  {swap && (
                    <span className="text-xs text-orange-500 ml-1">(sub for {ing.name})</span>
                  )}
                  {!swap && getIngredientAlias(ing.name) && (
                    <span className="text-gray-400 ml-1">({getIngredientAlias(ing.name)})</span>
                  )}
                  {ing.isOptional && (
                    <span className="text-gray-400 ml-1">(optional)</span>
                  )}
                  {availableSubs.length > 0 && (
                    <span className="inline-block ml-2 align-middle">
                      <SubstitutionsMenu
                        ingredientName={ing.name}
                        availableSubs={availableSubs}
                        activeSwap={swap}
                        onSelect={(sub) => onApplySwap(ing.id, sub)}
                        onRemove={() => onRemoveSwap(ing.id)}
                      />
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
