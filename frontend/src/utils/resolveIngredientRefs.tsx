import type { Ingredient } from '../types/recipe';
import { formatScaledAmount } from '../hooks/useScaling';

const REF_PATTERN = /\{([^}:]+)(?::(\d+(?:\.\d+)?)%)?\}/g;

/** Build a name → ingredient map. Unique names get the bare name as key.
 *  When a name appears multiple times all occurrences are numbered: "butter 1", "butter 2", … */
function buildIngredientMap(ingredients: Ingredient[]): Map<string, Ingredient> {
  const totals = new Map<string, number>();
  for (const ing of ingredients) totals.set(ing.name, (totals.get(ing.name) ?? 0) + 1);

  const ranks = new Map<string, number>();
  const result = new Map<string, Ingredient>();
  for (const ing of ingredients) {
    const rank = (ranks.get(ing.name) ?? 0) + 1;
    ranks.set(ing.name, rank);
    const key = (totals.get(ing.name) ?? 1) === 1 ? ing.name : `${ing.name} ${rank}`;
    result.set(key, ing);
  }
  return result;
}

/**
 * Expands {name:pct%} tokens in a step instruction into human-readable
 * ingredient amounts, optionally scaled by a serving multiplier.
 *
 * Returns an array of React nodes (strings and <span> elements) that can be
 * spread inside a <p> or similar container.
 */
export function resolveIngredientRefs(
  instruction: string,
  ingredients: Ingredient[],
  multiplier = 1,
  nameOverrides?: Map<string, string>,
): React.ReactNode[] {
  const ingByInternalId = buildIngredientMap(ingredients);
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  REF_PATTERN.lastIndex = 0;
  while ((match = REF_PATTERN.exec(instruction)) !== null) {
    const [full, internalId, pctStr] = match;
    const start = match.index;

    // Push the literal text before this token
    if (start > lastIndex) {
      parts.push(instruction.slice(lastIndex, start));
    }

    const ing = ingByInternalId.get(internalId);
    if (ing) {
      const pct = (pctStr !== undefined ? parseFloat(pctStr) : 100) / 100;
      const scaledAmount = ing.amount !== null ? ing.amount * pct * multiplier : null;
      const amountStr = scaledAmount !== null ? formatScaledAmount(scaledAmount) : null;
      const displayName = nameOverrides?.get(ing.id) ?? ing.name;
      const label = [amountStr, ing.unit, displayName].filter(Boolean).join(' ');
      const pctDisplay = pctStr ?? '100';
      parts.push(
        <span
          key={`${internalId}-${start}`}
          className="text-orange-700 font-medium"
          title={`${pctDisplay}% of ${ing.name}`}
        >
          {label}
        </span>,
      );
    } else {
      // Unknown ref — render raw so nothing is silently swallowed
      parts.push(full);
    }

    lastIndex = start + full.length;
  }

  // Remaining text after the last token
  if (lastIndex < instruction.length) {
    parts.push(instruction.slice(lastIndex));
  }

  // If no tokens were found, return the plain string (avoids wrapping in array)
  return parts.length === 0 ? [instruction] : parts;
}

/**
 * Returns a plain-text version of the instruction with {ref} tokens stripped
 * to just the resolved label (for use in aria labels, timer labels, etc).
 */
export function resolveIngredientRefsText(
  instruction: string,
  ingredients: Ingredient[],
  multiplier = 1,
  nameOverrides?: Map<string, string>,
): string {
  const ingByInternalId = buildIngredientMap(ingredients);
  return instruction.replace(REF_PATTERN, (_full, internalId, pctStr) => {
    const ing = ingByInternalId.get(internalId);
    if (!ing) return _full;
    const pct = (pctStr !== undefined ? parseFloat(pctStr) : 100) / 100;
    const scaledAmount = ing.amount !== null ? ing.amount * pct * multiplier : null;
    const amountStr = scaledAmount !== null ? formatScaledAmount(scaledAmount) : null;
    const displayName = nameOverrides?.get(ing.id) ?? ing.name;
    return [amountStr, ing.unit, displayName].filter(Boolean).join(' ');
  });
}
