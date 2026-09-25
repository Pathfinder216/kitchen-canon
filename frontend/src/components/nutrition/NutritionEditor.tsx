import { useId, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  NUTRIENT_KEYS,
  NUTRIENT_LABELS,
  fetchFdcFood,
  fetchNutritionStatus,
  searchNutrition,
  type FdcMatch,
  type NutrientKey,
} from '../../api/nutrition';
import { emptyNutritionDraft, nutritionToDraft, type NutritionDraft } from '../../utils/nutrition';

const SOURCE_LABELS: Record<NutritionDraft['source'], string> = {
  fdc: 'USDA FoodData Central',
  manual: 'entered manually',
  copied: 'copied from a similar ingredient',
};

function hasAnyValue(d: NutritionDraft): boolean {
  return NUTRIENT_KEYS.some((k) => d.values[k].trim() !== '') || !!d.gramsPerUnit;
}

interface Props {
  /** The ingredient being classified — the default USDA search term. */
  ingredientName: string;
  value: NutritionDraft;
  onChange: (draft: NutritionDraft) => void;
}

/**
 * Optional per-100 g nutrition for a catalog entry: a USDA FoodData Central lookup (when the
 * server has an FDC key) that prefills the fields, plus manual entry. Collapsed by default so
 * the classify panels stay compact; saving with nothing entered stays valid.
 */
export function NutritionEditor({ ingredientName, value, onChange }: Props) {
  const idPrefix = useId();
  const [open, setOpen] = useState(() => hasAnyValue(value));
  const [query, setQuery] = useState(ingredientName);
  const [pickError, setPickError] = useState<string | null>(null);
  const [picking, setPicking] = useState<number | null>(null);

  const { data: status } = useQuery({
    queryKey: ['nutrition-status'],
    queryFn: fetchNutritionStatus,
    staleTime: Infinity,
  });
  const lookupConfigured = status?.lookupConfigured === true;

  const search = useMutation({ mutationFn: (q: string) => searchNutrition(q) });

  function runSearch() {
    if (query.trim()) search.mutate(query.trim());
  }

  function setField(key: NutrientKey, raw: string) {
    // A hand edit makes the numbers the user's own; portions and the FDC reference still apply.
    onChange({ ...value, values: { ...value.values, [key]: raw }, source: 'manual' });
  }

  async function pick(match: FdcMatch) {
    setPickError(null);
    setPicking(match.fdcId);
    let chosen = match;
    try {
      // Search results carry no portions; the detail call adds gramsPerUnit.
      chosen = await fetchFdcFood(match.fdcId);
    } catch {
      setPickError('Could not load serving sizes from USDA — per-100 g values were still filled in.');
    } finally {
      setPicking(null);
    }
    onChange(nutritionToDraft(chosen.nutrition, 'fdc'));
    search.reset();
  }

  const summary = hasAnyValue(value) ? `(${SOURCE_LABELS[value.source]})` : '(optional)';

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-xs text-gray-600 hover:text-gray-800 font-medium"
      >
        {open ? '▾' : '▸'} Nutrition <span className="font-normal text-gray-400">{summary}</span>
      </button>

      {open && (
        <div className="space-y-2 pl-3 border-l-2 border-gray-100">
          {lookupConfigured ? (
            // Not a <form>: the classify panel can sit inside the recipe form, and forms can't nest.
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    runSearch();
                  }
                }}
                aria-label="USDA search term"
                className="flex-1 min-w-0 rounded-md border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={runSearch}
                disabled={search.isPending || !query.trim()}
                className="text-xs font-medium px-2 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {search.isPending ? 'Looking up…' : 'Look up nutrition'}
              </button>
            </div>
          ) : (
            status && (
              <p className="text-xs text-gray-400">
                Nutrition lookup not configured on this server — enter values manually.
              </p>
            )
          )}

          {search.isError && (
            <p className="text-xs text-red-600">
              {search.error instanceof Error ? search.error.message : 'Lookup failed'}
            </p>
          )}
          {search.data && search.data.length === 0 && (
            <p className="text-xs text-gray-500">No USDA matches — try a simpler name.</p>
          )}
          {search.data && search.data.length > 0 && (
            <ul className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white" aria-label="USDA matches">
              {search.data.map((m) => (
                <li key={m.fdcId}>
                  <button
                    type="button"
                    onClick={() => pick(m)}
                    disabled={picking !== null}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-orange-50 disabled:opacity-50 flex justify-between gap-2"
                  >
                    <span className="text-gray-800">{m.description}</span>
                    <span className="text-gray-500 shrink-0">
                      {picking === m.fdcId
                        ? 'Loading…'
                        : m.nutrition.per100g.calories !== undefined
                          ? `${Math.round(m.nutrition.per100g.calories)} kcal/100g`
                          : '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {pickError && <p className="text-xs text-amber-700">{pickError}</p>}

          {value.fdcDescription && (
            <p className="text-xs text-gray-500">USDA match: {value.fdcDescription}</p>
          )}

          <p className="text-xs text-gray-500">Per 100 g</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {NUTRIENT_KEYS.map((k) => {
              const id = `${idPrefix}-nutrient-${k}`;
              return (
                <div key={k}>
                  <label htmlFor={id} className="block text-[11px] text-gray-500">
                    {NUTRIENT_LABELS[k].label} ({NUTRIENT_LABELS[k].unit})
                  </label>
                  <input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={value.values[k]}
                    onChange={(e) => setField(k, e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              );
            })}
          </div>

          {value.gramsPerUnit && (
            <p className="text-xs text-gray-500">
              Portions:{' '}
              {Object.entries(value.gramsPerUnit)
                .map(([unit, g]) => `1 ${unit} = ${g} g`)
                .join(' · ')}
            </p>
          )}

          {hasAnyValue(value) && (
            <button
              type="button"
              onClick={() => onChange(emptyNutritionDraft())}
              className="text-xs text-gray-500 hover:text-red-600"
            >
              Clear nutrition
            </button>
          )}
        </div>
      )}
    </div>
  );
}
