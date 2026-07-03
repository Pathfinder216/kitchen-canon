import { describe, it, expect } from 'vitest';
import { recipeToText, buildRecipeMailto, MAILTO_BODY_MAX } from './exportRecipe';
import type { Recipe, Ingredient } from '../types/recipe';

const ingredients: Ingredient[] = [
  { id: 'i1', recipeId: 'r1', name: 'flour', originalName: null, amount: 2, unit: 'cups', isOptional: false, orderIndex: 0 },
  { id: 'i2', recipeId: 'r1', name: 'sugar', originalName: null, amount: 1, unit: 'cup', isOptional: true, orderIndex: 1 },
  { id: 'i3', recipeId: 'r1', name: 'salt', originalName: null, amount: null, unit: null, isOptional: false, orderIndex: 2 },
];

const recipe: Recipe = {
  id: 'r1',
  title: 'Pancakes',
  servings: 4,
  totalTime: 30,
  activeTime: 15,
  source: 'Grandma',
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 3,
  parentId: null,
  isLatest: true,
  authorNotes: 'Best with maple syrup.',
  personalNotes: 'Kids love these.',
  ingredients,
  steps: [
    { id: 's1', recipeId: 'r1', orderIndex: 0, instruction: 'Mix {flour} with the wet ingredients', timeMinutes: 5, isActiveTime: true },
    { id: 's2', recipeId: 'r1', orderIndex: 1, instruction: 'Cook on the griddle', timeMinutes: null, isActiveTime: false },
  ],
  courses: [],
  labels: [],
};

const noSwaps = new Map<string, string>();

describe('recipeToText', () => {
  it('renders a full recipe with title, meta, notes, ingredients, and steps', () => {
    const text = recipeToText(recipe, ingredients, noSwaps, 4);

    expect(text).toContain('Pancakes');
    expect(text).toContain('Serves: 4');
    expect(text).toContain('Total time: 30 min');
    expect(text).toContain('Active time: 15 min');
    expect(text).toContain('Source: Grandma');
    expect(text).toContain('Notes:');
    expect(text).toContain('Best with maple syrup.');
    expect(text).toContain('Personal Notes:');
    expect(text).toContain('Kids love these.');
    expect(text).toContain('- 2 cups flour');
    expect(text).toContain('v3 · Exported from Kitchen Canon');
  });

  it('marks optional ingredients and amount-less ingredients', () => {
    const text = recipeToText(recipe, ingredients, noSwaps, 4);
    expect(text).toContain('- 1 cup sugar (optional)');
    // No amount/unit → just the bare name.
    expect(text).toContain('- salt');
    expect(text).not.toContain('- 1 cup sugar\n'); // optional marker present, not the plain line
  });

  it('resolves {ref} tokens in step instructions to readable amounts', () => {
    const text = recipeToText(recipe, ingredients, noSwaps, 4);
    expect(text).toContain('1. Mix 2 cups flour with the wet ingredients [5 min]');
    expect(text).not.toContain('{flour}');
  });

  it('notes a substitution using the swap display name', () => {
    const swaps = new Map<string, string>([['i1', 'gluten-free flour']]);
    const text = recipeToText(recipe, ingredients, swaps, 4);
    expect(text).toContain('gluten-free flour (substituted for flour)');
  });

  it('omits optional sections that are empty', () => {
    const bare: Recipe = {
      ...recipe,
      source: null,
      authorNotes: null,
      personalNotes: null,
      totalTime: null,
      activeTime: null,
    };
    const text = recipeToText(bare, ingredients, noSwaps, 4);
    expect(text).not.toContain('Source:');
    expect(text).not.toContain('Notes:');
    expect(text).not.toContain('Personal Notes:');
    expect(text).not.toContain('Total time:');
  });
});

describe('buildRecipeMailto', () => {
  it('encodes the subject and body into a mailto URL', () => {
    const href = buildRecipeMailto(recipe, ingredients, noSwaps, 4);
    expect(href.startsWith('mailto:?subject=')).toBe(true);
    expect(href).toContain(`subject=${encodeURIComponent('Recipe: Pancakes')}`);
    expect(href).toContain('&body=');
    // Body round-trips the recipe text.
    const body = decodeURIComponent(href.split('&body=')[1]);
    expect(body).toContain('Pancakes');
    expect(body).toContain('- 2 cups flour');
  });

  it('truncates an over-long body and keeps the action usable', () => {
    const longNotes = 'x'.repeat(5000);
    const bigRecipe: Recipe = { ...recipe, authorNotes: longNotes };
    const href = buildRecipeMailto(bigRecipe, ingredients, noSwaps, 4);
    const body = decodeURIComponent(href.split('&body=')[1]);

    expect(body.length).toBeLessThanOrEqual(MAILTO_BODY_MAX);
    expect(body).toContain('use Share or Download');
    // Still a valid, usable mailto.
    expect(href.startsWith('mailto:?subject=')).toBe(true);
  });
});
