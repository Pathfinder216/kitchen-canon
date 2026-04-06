import { useState } from 'react';
import type { GroceryItem } from '../types/meal-plan';
import { formatScaledAmount } from '../hooks/useScaling';

interface GroceryListProps {
  items: GroceryItem[];
  onToggle?: (itemId: string, purchased: boolean) => void;
}

function formatAmount(amount: number | null, unit: string | null): string {
  if (amount === null) return '';
  const num = formatScaledAmount(amount);
  return unit ? `${num} ${unit}` : num;
}

export function GroceryList({ items, onToggle }: GroceryListProps) {
  const [copied, setCopied] = useState(false);
  const purchased = items.filter((i) => i.purchased);
  const remaining = items.filter((i) => !i.purchased);

  function copyToClipboard() {
    const text = remaining
      .map((i) => i.ingredient + (i.amount !== null ? ` — ${formatAmount(i.amount, i.unit)}` : ''))
      .join('\n');
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
            <span className="ml-2 text-sm text-gray-500">— {formatAmount(item.amount, item.unit)}</span>
          )}
        </label>
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
          <ul className="divide-y divide-gray-100">{remaining.map(renderItem)}</ul>
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
    </div>
  );
}
