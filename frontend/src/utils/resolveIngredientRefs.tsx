import type { Ingredient } from '../types/recipe';
import { formatScaledAmount } from '../hooks/useScaling';

const REF_PATTERN = /\{([^}:]+)(?::(\d+(?:\.\d+)?)%)?\}/g;

/** A remainder below this is float noise (e.g. 100 − (33.3 + 33.3 + 33.4)) and counts as 0. */
const REMAINING_EPSILON = 1e-6;

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

/** One `{key}` / `{key:NN%}` token, resolved to the percent it stands for. */
export interface ResolvedRefPercent {
  /** Ingredient reference key as written in the token ("butter", "butter 2"). */
  key: string;
  /** Percent of the ingredient this token represents. */
  pct: number;
  /** True for a bare `{key}` token, whose percent is whatever remained. */
  bare: boolean;
}

/**
 * Walks step instructions in order (callers pass them sorted by `orderIndex`) and
 * resolves every reference token to a percent:
 *   - `{key:NN%}` is always NN%, exactly as written (never capped);
 *   - bare `{key}` is whatever remains of that key: max(0, 100 − everything consumed
 *     by earlier tokens), and it consumes that remainder itself.
 * Consumption is tracked per reference key, so duplicate-name ingredients ("butter 1",
 * "butter 2") are independent. Tokens within one instruction consume in text order.
 *
 * Returns one array per instruction, one entry per token, in token order.
 */
export function computeRemainingPercents(instructions: string[]): ResolvedRefPercent[][] {
  const consumed = new Map<string, number>();
  return instructions.map((instruction) => {
    const refs: ResolvedRefPercent[] = [];
    for (const match of instruction.matchAll(REF_PATTERN)) {
      const [, key, pctStr] = match;
      const used = consumed.get(key) ?? 0;
      const bare = pctStr === undefined;
      const remaining = 100 - used;
      const pct = bare ? (remaining < REMAINING_EPSILON ? 0 : remaining) : parseFloat(pctStr);
      consumed.set(key, used + pct);
      refs.push({ key, pct, bare });
    }
    return refs;
  });
}

/** Instructions of the steps before `index` — the context a bare `{key}` needs. */
export function priorInstructions(steps: { instruction: string }[], index: number): string[] {
  return steps.slice(0, index).map((s) => s.instruction);
}

function percentsFor(instruction: string, prior: string[]): ResolvedRefPercent[] {
  return computeRemainingPercents([...prior, instruction])[prior.length];
}

function formatPct(pct: number): string {
  return String(Math.round(pct * 100) / 100);
}

function refLabel(ing: Ingredient, pct: number, multiplier: number, nameOverrides?: Map<string, string>): string {
  const scaledAmount = ing.amount !== null ? ing.amount * (pct / 100) * multiplier : null;
  const amountStr = scaledAmount !== null ? formatScaledAmount(scaledAmount) : null;
  const displayName = nameOverrides?.get(ing.id) ?? ing.name;
  return [amountStr, ing.unit, displayName].filter(Boolean).join(' ');
}

/**
 * Expands {name:pct%} / {name} tokens in a step instruction into human-readable
 * ingredient amounts, optionally scaled by a serving multiplier.
 *
 * A bare `{name}` means "whatever remains" after the explicit references in
 * `prior` (the instructions of the earlier steps, in order) and earlier tokens in
 * this instruction — see `computeRemainingPercents`. Use `priorInstructions(steps, i)`.
 *
 * Returns an array of React nodes (strings and <span> elements) that can be
 * spread inside a <p> or similar container.
 */
export function resolveIngredientRefs(
  instruction: string,
  ingredients: Ingredient[],
  multiplier = 1,
  nameOverrides?: Map<string, string>,
  prior: string[] = [],
): React.ReactNode[] {
  const ingByInternalId = buildIngredientMap(ingredients);
  const percents = percentsFor(instruction, prior);
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;

  for (const match of instruction.matchAll(REF_PATTERN)) {
    const [full, internalId] = match;
    const start = match.index;
    const { pct, bare } = percents[tokenIndex++];

    // Push the literal text before this token
    if (start > lastIndex) {
      parts.push(instruction.slice(lastIndex, start));
    }

    const ing = ingByInternalId.get(internalId);
    if (ing) {
      // Only a bare ref can be "exhausted"; an explicit {x:0%} is taken as written.
      const exhausted = bare && pct === 0;
      const title = exhausted
        ? `Nothing left of ${ing.name} — earlier steps already use 100%`
        : `${bare ? 'remaining ' : ''}${formatPct(pct)}% of ${ing.name}`;
      parts.push(
        <span
          key={`${internalId}-${start}`}
          className={exhausted
            ? 'text-red-700 font-medium underline decoration-wavy decoration-red-400'
            : 'text-orange-700 font-medium'}
          title={title}
          data-exhausted={exhausted || undefined}
        >
          {refLabel(ing, pct, multiplier, nameOverrides)}
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
 * `prior` has the same meaning as in `resolveIngredientRefs`.
 */
export function resolveIngredientRefsText(
  instruction: string,
  ingredients: Ingredient[],
  multiplier = 1,
  nameOverrides?: Map<string, string>,
  prior: string[] = [],
): string {
  const ingByInternalId = buildIngredientMap(ingredients);
  const percents = percentsFor(instruction, prior);
  let tokenIndex = 0;
  return instruction.replace(REF_PATTERN, (full, internalId: string) => {
    const { pct } = percents[tokenIndex++];
    const ing = ingByInternalId.get(internalId);
    if (!ing) return full;
    return refLabel(ing, pct, multiplier, nameOverrides);
  });
}
