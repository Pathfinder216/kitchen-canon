import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GroceryItem } from '../types/meal-plan';
import { formatQuantity } from '../utils/convertUnit';
import { useUnitSystem } from '../hooks/usePreferences';
import type { UnitSystemPreference } from '../api/preferences';
import { useAisles, OTHER_AISLE, type AisleVocabulary } from '../hooks/useAisles';
import { setIngredientAisle } from '../api/ingredients';
import { Menu, MenuItemButton } from './ui/Menu';
import { Modal } from './ui/Modal';

interface GroceryListProps {
  items: GroceryItem[];
  onToggle?: (itemId: string, purchased: boolean) => void;
}

// Unit conversion (plan 27) is applied at render only: consolidation already happened server-side
// in canonical units, so converting each consolidated line is exact.
function itemText(item: GroceryItem, unitSystem: UnitSystemPreference): string {
  return item.ingredient + (item.amount !== null ? ` — ${formatQuantity(item.amount, item.unit, unitSystem)}` : '');
}

/** Normalize an item's aisle: missing or unknown to the vocabulary → "Other". */
function aisleKey(item: GroceryItem, vocab: AisleVocabulary): string {
  const a = item.aisle;
  if (!a) return OTHER_AISLE;
  // Before the vocabulary loads we can't validate keys; trust what the server sent.
  if (vocab.aisles.length > 0 && !vocab.aisles.includes(a)) return OTHER_AISLE;
  return a;
}

/** Group items by aisle in vocabulary order, with "Other" always last. */
function groupByAisle(
  items: GroceryItem[],
  vocab: AisleVocabulary,
): { aisle: string; label: string; items: GroceryItem[] }[] {
  const groups = new Map<string, GroceryItem[]>();
  for (const item of items) {
    const key = aisleKey(item, vocab);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  const rank = (key: string) => {
    if (key === OTHER_AISLE) return Number.MAX_SAFE_INTEGER;
    const i = vocab.aisles.indexOf(key);
    return i === -1 ? Number.MAX_SAFE_INTEGER - 1 : i;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([aisle, list]) => ({
      aisle,
      label: vocab.aisleLabels[aisle] ?? (aisle === OTHER_AISLE ? 'Other' : aisle),
      items: list,
    }));
}

function KebabIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
    </svg>
  );
}

function ChangeAisleDialog({
  item,
  vocab,
  onClose,
}: {
  item: GroceryItem | null;
  vocab: AisleVocabulary;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ name, aisle }: { name: string; aisle: string }) => setIngredientAisle(name, aisle),
    onSuccess: () => {
      // Aisles are resolved at read time on every meal plan; the catalog list shows the override.
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] });
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      onClose();
    },
  });
  const current = item ? aisleKey(item, vocab) : null;

  return (
    <Modal
      open={item !== null}
      onClose={() => {
        mutation.reset();
        onClose();
      }}
      title={item ? `Change aisle for ${item.ingredient}` : undefined}
    >
      <p className="text-xs text-gray-500 mb-3">
        Applies to your grocery lists only.
      </p>
      <ul className="space-y-1 max-h-80 overflow-y-auto">
        {vocab.aisles.map((aisle) => (
          <li key={aisle}>
            <button
              type="button"
              disabled={mutation.isPending}
              aria-pressed={aisle === current}
              onClick={() => item && mutation.mutate({ name: item.ingredient, aisle })}
              className={`block w-full text-left text-sm px-3 py-2 rounded-md transition-colors disabled:opacity-50 ${
                aisle === current ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {vocab.aisleLabels[aisle] ?? aisle}
            </button>
          </li>
        ))}
      </ul>
      {mutation.isError && <p className="text-xs text-red-600 mt-2">Failed to change aisle.</p>}
    </Modal>
  );
}

export function GroceryList({ items, onToggle }: GroceryListProps) {
  const vocab = useAisles();
  const unitSystem = useUnitSystem();
  const [copied, setCopied] = useState(false);
  const [changing, setChanging] = useState<GroceryItem | null>(null);
  const purchased = items.filter((i) => i.purchased);
  const remaining = items.filter((i) => !i.purchased);
  const sections = groupByAisle(remaining, vocab);

  function copyToClipboard() {
    const text = sections
      .map((s) => [`${s.label}:`, ...s.items.map((item) => itemText(item, unitSystem))].join('\n'))
      .join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function renderItem(item: GroceryItem) {
    return (
      <li key={item.id} className="flex items-center gap-3 py-2">
        <input
          type="checkbox"
          id={`grocery-${item.id}`}
          checked={item.purchased}
          onChange={(e) => onToggle?.(item.id, e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
        />
        <label
          htmlFor={`grocery-${item.id}`}
          className={`flex-1 cursor-pointer select-none ${item.purchased ? 'line-through text-gray-400' : 'text-gray-800'}`}
        >
          {item.ingredient}
          {item.amount !== null && (
            <span className="ml-2 text-sm text-gray-500">— {formatQuantity(item.amount, item.unit, unitSystem)}</span>
          )}
        </label>
        {!item.purchased && vocab.aisles.length > 0 && (
          <Menu
            label={<KebabIcon />}
            buttonAriaLabel={`Options for ${item.ingredient}`}
            buttonClassName="p-1 text-gray-400 hover:text-gray-600 rounded"
            anchor="bottom end"
          >
            <MenuItemButton onClick={() => setChanging(item)}>Change aisle</MenuItemButton>
          </Menu>
        )}
      </li>
    );
  }

  if (items.length === 0) {
    return <p className="text-gray-500 text-sm">No grocery items.</p>;
  }

  return (
    <div>
      {remaining.length > 0 && (
        <>
          <button
            onClick={copyToClipboard}
            className="mb-3 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors"
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
          <div className="space-y-3">
            {sections.map((s) => (
              <section key={s.aisle} aria-label={s.label}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{s.label}</h3>
                <ul className="divide-y divide-gray-100">{s.items.map(renderItem)}</ul>
              </section>
            ))}
          </div>
        </>
      )}
      {purchased.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
            Purchased ({purchased.length})
          </p>
          <ul className="divide-y divide-gray-100">{purchased.map(renderItem)}</ul>
        </div>
      )}
      <ChangeAisleDialog item={changing} vocab={vocab} onClose={() => setChanging(null)} />
    </div>
  );
}
