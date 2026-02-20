import { useQuery } from '@tanstack/react-query';
import { fetchSubstitutionsForRecipe } from '../api/substitutions';

interface SubstitutionListProps {
  recipeId: string;
}

export function SubstitutionList({ recipeId }: SubstitutionListProps) {
  const { data: subs, isLoading } = useQuery({
    queryKey: ['substitutions', recipeId],
    queryFn: () => fetchSubstitutionsForRecipe(recipeId),
  });

  if (isLoading || !subs || subs.length === 0) return null;

  // Group by fromIngredient
  const grouped = new Map<string, typeof subs>();
  for (const sub of subs) {
    if (!grouped.has(sub.fromIngredient)) grouped.set(sub.fromIngredient, []);
    grouped.get(sub.fromIngredient)!.push(sub);
  }

  return (
    <details className="mt-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
      <summary className="px-5 py-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 select-none">
        Ingredient substitutions ({subs.length})
      </summary>
      <div className="px-5 pb-4 pt-2 space-y-3">
        {[...grouped.entries()].map(([ingredient, list]) => (
          <div key={ingredient}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Instead of <span className="text-gray-800">{ingredient}</span>
            </p>
            <ul className="space-y-1">
              {list.map((sub) => (
                <li key={sub.id} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-orange-500">→</span>
                  <span>
                    <span className="font-medium">{sub.toIngredient}</span>
                    {sub.ratio !== 1 && (
                      <span className="text-gray-400 ml-1">
                        (use {sub.ratio}× the amount)
                      </span>
                    )}
                    {sub.notes && (
                      <span className="text-gray-500 ml-1 italic">— {sub.notes}</span>
                    )}
                    {sub.isOfficial && (
                      <span className="ml-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                        verified
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
