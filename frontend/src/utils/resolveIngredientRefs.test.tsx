import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { Ingredient } from '../types/recipe';
import {
  computeRemainingPercents,
  priorInstructions,
  resolveIngredientRefs,
  resolveIngredientRefsText,
} from './resolveIngredientRefs';

function ing(id: string, name: string, amount: number | null, unit: string | null): Ingredient {
  return { id, recipeId: 'r1', name, originalName: null, amount, unit, isOptional: false, note: null, orderIndex: 0 };
}

const butter = ing('i1', 'butter', 4, 'tbsp');
const flour = ing('i2', 'flour', 2, 'cups');
const ingredients = [butter, flour];

/** Resolve step `index` of `steps` to plain text, with earlier steps as context. */
function textAt(steps: string[], index: number, ings = ingredients, multiplier = 1): string {
  return resolveIngredientRefsText(steps[index], ings, multiplier, undefined, priorInstructions(steps.map((instruction) => ({ instruction })), index));
}

function renderAt(steps: string[], index: number, ings = ingredients, multiplier = 1) {
  const prior = steps.slice(0, index);
  return render(<p>{resolveIngredientRefs(steps[index], ings, multiplier, undefined, prior)}</p>);
}

describe('computeRemainingPercents', () => {
  it('resolves a lone bare ref to 100%', () => {
    expect(computeRemainingPercents(['Melt {butter}.'])).toEqual([[{ key: 'butter', pct: 100, bare: true }]]);
  });

  it('gives a bare ref whatever earlier explicit refs left over', () => {
    const result = computeRemainingPercents(['Melt {butter:50%}.', 'Rest.', 'Brush with {butter}.']);
    expect(result[2]).toEqual([{ key: 'butter', pct: 50, bare: true }]);
  });

  it('sums several explicit refs in one earlier step', () => {
    const result = computeRemainingPercents(['Add {butter:30%}, then {butter:30%}.', 'Finish with {butter}.']);
    expect(result[1][0].pct).toBe(40);
  });

  it('honours explicit percents as written and floors the remainder at 0 on over-consumption', () => {
    const result = computeRemainingPercents(['{butter:80%}', '{butter:40%}', '{butter}']);
    expect(result.map((refs) => refs[0].pct)).toEqual([80, 40, 0]);
  });

  it('lets a bare ref consume its remainder so a later bare ref gets 0', () => {
    const result = computeRemainingPercents(['{butter:25%}', '{butter}', '{butter}']);
    expect(result.map((refs) => refs[0].pct)).toEqual([25, 75, 0]);
  });

  it('treats float-noise remainders as exactly 0', () => {
    // 100 - (0.1 + 64.1 + 35.8) === 1.4e-14 in IEEE doubles
    const result = computeRemainingPercents(['{butter:0.1%} {butter:64.1%} {butter:35.8%}', '{butter}']);
    expect(result[1][0].pct).toBe(0);
  });

  it('consumes in token order within a single step', () => {
    expect(computeRemainingPercents(['{butter}, {butter:10%}'])[0].map((r) => r.pct)).toEqual([100, 10]);
    expect(computeRemainingPercents(['{butter:10%}, {butter}'])[0].map((r) => r.pct)).toEqual([10, 90]);
  });
});

describe('resolveIngredientRefsText', () => {
  it('renders a bare-only ref as the full amount', () => {
    expect(textAt(['Melt {butter}.'], 0)).toBe('Melt 4 tbsp butter.');
  });

  it('renders 50% in step 1 then bare in step 3 as the remaining half', () => {
    const steps = ['Melt {butter:50%}.', 'Whisk {flour}.', 'Brush with {butter}.'];
    expect(textAt(steps, 0)).toBe('Melt 2 tbsp butter.');
    expect(textAt(steps, 2)).toBe('Brush with 2 tbsp butter.');
  });

  it('renders 30% + 30% then bare as 40%', () => {
    const steps = ['Add {butter:30%} and {butter:30%}.', 'Finish with {butter}.'];
    expect(textAt(steps, 1)).toBe('Finish with 1.6 tbsp butter.');
  });

  it('tracks duplicate ingredient names independently per key', () => {
    const dupes = [ing('a', 'butter', 2, 'tbsp'), ing('b', 'butter', 6, 'tbsp')];
    const steps = ['Melt {butter 1:50%} and {butter 2:50%}.', 'Add {butter 1}, later {butter 2}.'];
    // butter 1: remaining 50% of 2 = 1; butter 2: remaining 50% of 6 = 3
    expect(textAt(steps, 1, dupes)).toBe('Add 1 tbsp butter, later 3 tbsp butter.');
  });

  it('applies the multiplier to the remaining share', () => {
    const steps = ['Melt {butter:25%}.', 'Add {butter}.'];
    // remaining 75% of 4 tbsp = 3 tbsp, doubled = 6 tbsp
    expect(textAt(steps, 1, ingredients, 2)).toBe('Add 6 tbsp butter.');
    expect(textAt(steps, 1, ingredients, 0.5)).toBe('Add 1 ½ tbsp butter.');
  });

  it('keeps unknown refs verbatim', () => {
    expect(textAt(['Add {sugar} and {butter}.'], 0)).toBe('Add {sugar} and 4 tbsp butter.');
  });

  it('defaults to no prior context (bare = 100%)', () => {
    expect(resolveIngredientRefsText('Add {butter}.', ingredients)).toBe('Add 4 tbsp butter.');
  });
});

describe('resolveIngredientRefs', () => {
  it('titles a bare ref with its remaining percent', () => {
    const { container } = renderAt(['Melt {butter:50%}.', 'Brush with {butter}.'], 1);
    const span = container.querySelector('span')!;
    expect(span).toHaveTextContent('2 tbsp butter');
    expect(span).toHaveAttribute('title', 'remaining 50% of butter');
    expect(span).not.toHaveAttribute('data-exhausted');
  });

  it('titles an explicit ref with its percent', () => {
    const { container } = renderAt(['Melt {butter:50%}.'], 0);
    expect(container.querySelector('span')).toHaveAttribute('title', '50% of butter');
  });

  it('flags a bare ref with nothing remaining with warning styling', () => {
    const { container } = renderAt(['{butter:80%}', '{butter:40%}', 'Add {butter}.'], 2);
    const span = container.querySelector('span')!;
    expect(span).toHaveTextContent('0 tbsp butter');
    expect(span).toHaveAttribute('data-exhausted', 'true');
    expect(span.className).toMatch(/text-red-700/);
    expect(span.getAttribute('title')).toMatch(/nothing left of butter/i);
  });

  it('flags a bare ref left with only float noise as exhausted', () => {
    const { container } = renderAt(['{butter:0.1%} {butter:64.1%} {butter:35.8%}', 'Add {butter}.'], 1);
    const span = container.querySelector('span')!;
    expect(span).toHaveTextContent('0 tbsp butter');
    expect(span).toHaveAttribute('data-exhausted', 'true');
  });

  it('does not flag an explicit 0% ref as exhausted', () => {
    const { container } = renderAt(['Add {butter:0%}.'], 0);
    const span = container.querySelector('span')!;
    expect(span).toHaveTextContent('0 tbsp butter');
    expect(span).not.toHaveAttribute('data-exhausted');
    expect(span.className).not.toMatch(/text-red-700/);
    expect(span).toHaveAttribute('title', '0% of butter');
  });

  it('renders the same numbers as the text variant', () => {
    const steps = ['Melt {butter:25%}.', 'Add {butter} and {flour}.'];
    const { container } = renderAt(steps, 1, ingredients, 2);
    expect(container.textContent).toBe(textAt(steps, 1, ingredients, 2));
  });
});
