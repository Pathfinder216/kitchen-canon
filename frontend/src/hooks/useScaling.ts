import { useState } from 'react';
import type { Ingredient } from '../types/recipe';

export function useScaling(defaultServings: number) {
  const [targetServings, setTargetServings] = useState(defaultServings);

  const multiplier = defaultServings > 0 ? targetServings / defaultServings : 1;

  function scaleIngredient(ing: Ingredient): Ingredient {
    if (ing.amount === null) return ing;
    return { ...ing, amount: ing.amount * multiplier };
  }

  return { targetServings, setTargetServings, multiplier, scaleIngredient };
}

export function formatScaledAmount(amount: number | null): string {
  if (amount === null) return '';
  // Show as fraction-friendly decimal (up to 2 decimal places, trimmed)
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) return rounded.toString();
  // Try to express as a simple fraction for common cooking amounts
  const fractions: [number, string][] = [
    [0.125, '⅛'], [0.25, '¼'], [0.333, '⅓'], [0.375, '⅜'],
    [0.5, '½'], [0.625, '⅝'], [0.667, '⅔'], [0.75, '¾'], [0.875, '⅞'],
  ];
  const whole = Math.floor(rounded);
  const frac = rounded - whole;
  for (const [val, glyph] of fractions) {
    if (Math.abs(frac - val) < 0.01) {
      return whole > 0 ? `${whole} ${glyph}` : glyph;
    }
  }
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}
