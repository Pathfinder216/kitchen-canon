import { formatScaledAmount } from '../hooks/useScaling';
import type { UnitSystemPreference } from '../api/preferences';

// Display-time unit conversion (plan 27). Storage never changes: recipes and grocery items keep
// their authored/canonical units, and this module only decides how to *show* a quantity in the
// user's preferred system. `original` is a strict no-op.

type System = 'imperial' | 'metric';
type Base = 'ml' | 'g';

interface ConvertibleUnit {
  system: System;
  base: Base;
  /** Multiply an amount in this unit by `toBase` to get millilitres / grams. */
  toBase: number;
}

// ⚠️ Hand-maintained MIRROR of the `conversion` factors in backend/src/constants/units.ts
// (the backend's canonical unit table is the source of truth). There is no automated mirror
// check — when a volume/weight unit is added or changed there, update this table too.
// "imperial" here means US customary (US cup = 236.588 ml), matching the backend table.
export const UNIT_CONVERSIONS: Readonly<Record<string, ConvertibleUnit>> = {
  tsp: { system: 'imperial', base: 'ml', toBase: 4.92892 },
  tbsp: { system: 'imperial', base: 'ml', toBase: 14.7868 },
  cup: { system: 'imperial', base: 'ml', toBase: 236.588 },
  'fl oz': { system: 'imperial', base: 'ml', toBase: 29.5735 },
  pt: { system: 'imperial', base: 'ml', toBase: 473.176 },
  qt: { system: 'imperial', base: 'ml', toBase: 946.353 },
  gal: { system: 'imperial', base: 'ml', toBase: 3785.41 },
  ml: { system: 'metric', base: 'ml', toBase: 1 },
  l: { system: 'metric', base: 'ml', toBase: 1000 },
  oz: { system: 'imperial', base: 'g', toBase: 28.3495 },
  lb: { system: 'imperial', base: 'g', toBase: 453.592 },
  g: { system: 'metric', base: 'g', toBase: 1 },
  kg: { system: 'metric', base: 'g', toBase: 1000 },
};

// Units are normalized to the canonical abbreviations at write time (plan 18), but data written
// before that migration ran may still carry long/plural spellings — accept the common ones.
const UNIT_ALIASES: Readonly<Record<string, string>> = {
  teaspoon: 'tsp', tablespoon: 'tbsp', 'fluid ounce': 'fl oz', pint: 'pt', quart: 'qt', gallon: 'gal',
  milliliter: 'ml', millilitre: 'ml', liter: 'l', litre: 'l', ounce: 'oz', pound: 'lb',
  gram: 'g', kilogram: 'kg', lbs: 'lb',
};

function lookupUnit(unit: string): ConvertibleUnit | undefined {
  const key = unit.trim().toLowerCase();
  const direct = UNIT_CONVERSIONS[key] ?? UNIT_CONVERSIONS[UNIT_ALIASES[key] ?? ''];
  if (direct || !key.endsWith('s')) return direct;
  const singular = key.slice(0, -1);
  return UNIT_CONVERSIONS[singular] ?? UNIT_CONVERSIONS[UNIT_ALIASES[singular] ?? ''];
}

// Kitchen-sane fraction grids that imperial amounts snap to.
const EIGHTHS = [0, 1 / 8, 1 / 4, 3 / 8, 1 / 2, 5 / 8, 3 / 4, 7 / 8, 1];
const QUARTERS_THIRDS = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1];
const QUARTERS = [0, 1 / 4, 1 / 2, 3 / 4, 1];
const HALVES = [0, 1 / 2, 1];

function snapToGrid(value: number, grid: number[]): number {
  const whole = Math.floor(value);
  const frac = value - whole;
  let best = grid[0];
  for (const step of grid) {
    if (Math.abs(frac - step) < Math.abs(frac - best)) best = step;
  }
  return whole + best;
}

function roundDecimals(value: number, places: number): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

/** ml / g: whole numbers, and to the nearest 5 from 100 up (½ cup → 120 ml, not 118 ml). */
function roundSmallMetric(value: number): number {
  return value >= 100 ? Math.round(value / 5) * 5 : Math.round(value);
}

interface TargetUnit {
  unit: string;
  /** Smallest amount (in this unit) for which this unit is chosen over the next-smaller one. */
  min: number;
  /** Rounds a raw amount in this unit to a kitchen-sane display value. */
  round: (value: number) => number;
}

// Candidate display units per target system and base, smallest → largest. We pick the largest unit
// whose amount is ≥ its `min` (830 ml, not 0.83 l; 1 ½ lb, not 24 oz). Cups use a ¼ threshold
// rather than 1 because "¼ cup" is how cooks write 60 ml, not "4 tbsp". pt / fl oz are never
// chosen as targets (they're valid sources) — cups and quarts cover the range more familiarly.
const LADDERS: Record<System, Record<Base, TargetUnit[]>> = {
  metric: {
    ml: [
      { unit: 'ml', min: 0, round: roundSmallMetric },
      { unit: 'l', min: 1, round: (v) => roundDecimals(v, 2) },
    ],
    g: [
      { unit: 'g', min: 0, round: roundSmallMetric },
      { unit: 'kg', min: 1, round: (v) => roundDecimals(v, 2) },
    ],
  },
  imperial: {
    ml: [
      { unit: 'tsp', min: 0, round: (v) => snapToGrid(v, EIGHTHS) },
      { unit: 'tbsp', min: 1, round: (v) => snapToGrid(v, HALVES) },
      { unit: 'cup', min: 0.25, round: (v) => snapToGrid(v, QUARTERS_THIRDS) },
      { unit: 'qt', min: 1, round: (v) => snapToGrid(v, QUARTERS) },
      { unit: 'gal', min: 1, round: (v) => snapToGrid(v, QUARTERS) },
    ],
    g: [
      { unit: 'oz', min: 0, round: (v) => snapToGrid(v, QUARTERS) },
      { unit: 'lb', min: 1, round: (v) => snapToGrid(v, QUARTERS) },
    ],
  },
};

function roundFor(value: number, target: TargetUnit): number {
  const rounded = target.round(value);
  // Never round a real quantity down to nothing (e.g. 0.3 ml, or 1/16 tsp): keep one
  // significant decimal instead.
  if (rounded === 0 && value > 0) return Number(value.toPrecision(1));
  return rounded;
}

export interface DisplayQuantity {
  amount: number;
  unit: string | null;
  /** True when the quantity was converted to another system (and rounded for display). */
  converted: boolean;
}

/**
 * Convert a quantity for display in `target`. Returns the input untouched when there's nothing to
 * do: `original` preference, no/unknown unit, a count unit (`clove`, `can`…), or a unit that is
 * already in the target system (we never re-express `24 oz` as `1 ½ lb` — that's the author's
 * choice, not a conversion).
 */
export function convertForDisplay(
  amount: number,
  unit: string | null,
  target: UnitSystemPreference,
): DisplayQuantity {
  const unchanged: DisplayQuantity = { amount, unit, converted: false };
  if (target === 'original' || !unit) return unchanged;
  const source = lookupUnit(unit);
  if (!source || source.system === target) return unchanged;

  const base = amount * source.toBase;
  const ladder = LADDERS[target][source.base];
  let choice = ladder[0];
  for (const candidate of ladder) {
    if (base / UNIT_CONVERSIONS[candidate.unit].toBase >= candidate.min) choice = candidate;
  }
  const value = base / UNIT_CONVERSIONS[choice.unit].toBase;
  return { amount: roundFor(value, choice), unit: choice.unit, converted: true };
}

/**
 * Format a quantity (amount + unit) for display, converting to `target` when needed.
 * `null` amount → '' (callers render the ingredient name alone, as before). Unconverted and
 * imperial amounts use the shared fraction formatting (`½ cup`); converted metric amounts are
 * plain decimals (`1.25 l`, never `1 ¼ l`).
 */
export function formatQuantity(
  amount: number | null,
  unit: string | null,
  target: UnitSystemPreference,
): string {
  if (amount === null) return '';
  const q = convertForDisplay(amount, unit, target);
  const num = q.converted && target === 'metric' ? String(q.amount) : formatScaledAmount(q.amount);
  return q.unit ? `${num} ${q.unit}` : num;
}
