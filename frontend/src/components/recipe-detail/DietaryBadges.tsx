import type { DietaryInfo } from '../../types/meal-plan';

interface DietaryBadgesProps {
  dietaryInfo: DietaryInfo | undefined;
  allergenLabels: Record<string, string>;
  dietLabels: Record<string, string>;
}

/** Allergen / diet chips plus an "unclassified ingredients" note. */
export function DietaryBadges({ dietaryInfo, allergenLabels, dietLabels }: DietaryBadgesProps) {
  if (
    !dietaryInfo ||
    (dietaryInfo.allergens.length === 0 &&
      dietaryInfo.diets.length === 0 &&
      dietaryInfo.unknownIngredients.length === 0)
  ) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {dietaryInfo.allergens.map((a) => (
        <span key={a} title="Contains allergen" className="px-2.5 py-0.5 text-xs rounded-full bg-red-50 border border-red-200 text-red-700">
          {allergenLabels[a] ?? a}
        </span>
      ))}
      {dietaryInfo.diets.map((d) => (
        <span key={d} title="Diet compatible" className="px-2.5 py-0.5 text-xs rounded-full bg-green-50 border border-green-200 text-green-700">
          {dietLabels[d] ?? d}
        </span>
      ))}
      {dietaryInfo.unknownIngredients.length > 0 && (
        <span title={`Unclassified: ${dietaryInfo.unknownIngredients.join(', ')}`} className="px-2.5 py-0.5 text-xs rounded-full bg-amber-50 border border-amber-200 text-amber-700 cursor-help">
          {dietaryInfo.unknownIngredients.length} unclassified
        </span>
      )}
    </div>
  );
}
