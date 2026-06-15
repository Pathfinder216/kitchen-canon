import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRecipeFormState, parseFraction } from './useRecipeFormState';
import type { Recipe } from '../../types/recipe';
import type { ParsedRecipe } from '../../api/import';

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1', title: 'Initial Title', servings: 2, totalTime: null, activeTime: null,
    source: 'initial source', archived: false, createdAt: '', updatedAt: '',
    version: 1, parentId: null, isLatest: true, authorNotes: 'initial author notes',
    personalNotes: 'initial personal notes',
    ingredients: [
      { id: 'i1', name: 'Flour', originalName: 'Flour', amount: 2, unit: 'cups', isOptional: false, orderIndex: 0 },
    ],
    steps: [
      { id: 's1', orderIndex: 0, instruction: 'Initial step', timeMinutes: 5, isActiveTime: true },
    ],
    ...overrides,
  } as Recipe;
}

function makeImport(overrides: Partial<ParsedRecipe> = {}): ParsedRecipe {
  return {
    title: 'Imported Title',
    servings: 4,
    totalTime: 30,
    activeTime: 15,
    source: 'imported source',
    authorNotes: 'imported author notes',
    ingredients: [
      { name: 'Sugar', originalName: 'Sugar', amount: 1, unit: 'cup', isOptional: false, orderIndex: 0 },
    ],
    steps: [
      { orderIndex: 0, instruction: 'Imported step', timeMinutes: null, isActiveTime: true },
    ],
    ...overrides,
  } as ParsedRecipe;
}

describe('parseFraction', () => {
  it('parses mixed, simple fractions, decimals, and empty input', () => {
    expect(parseFraction('1 1/2')).toBe(1.5);
    expect(parseFraction('1/4')).toBe(0.25);
    expect(parseFraction('2.5')).toBe(2.5);
    expect(parseFraction('')).toBeUndefined();
    expect(parseFraction('  ')).toBeUndefined();
    expect(parseFraction('abc')).toBeUndefined();
  });
});

describe('useRecipeFormState', () => {
  it('seeds shared fields from initialData when both are present (initialData wins)', () => {
    const { result } = renderHook(() =>
      useRecipeFormState({ initialData: makeRecipe(), importData: makeImport() }),
    );
    expect(result.current.title).toBe('Initial Title');
    expect(result.current.servings).toBe('2');
    expect(result.current.source).toBe('initial source');
    expect(result.current.authorNotes).toBe('initial author notes');
    expect(result.current.personalNotes).toBe('initial personal notes');
    expect(result.current.ingredients[0].name).toBe('Flour');
    expect(result.current.steps[0].instruction).toBe('Initial step');
    // step DB id preserved from initialData
    expect(result.current.steps[0].existingId).toBe('s1');
  });

  it('seeds from importData when no initialData (no DB ids, no personal notes)', () => {
    const { result } = renderHook(() => useRecipeFormState({ importData: makeImport() }));
    expect(result.current.title).toBe('Imported Title');
    expect(result.current.servings).toBe('4');
    expect(result.current.personalNotes).toBe('');
    expect(result.current.ingredients[0].name).toBe('Sugar');
    expect(result.current.steps[0].existingId).toBeUndefined();
    // null timeMinutes from import becomes 0
    expect(result.current.steps[0].timeMinutes).toBe(0);
    expect(result.current.steps[0].timeMinutesText).toBe('0');
  });

  it('defaults servings to "1" and empty collections when no seed', () => {
    const { result } = renderHook(() => useRecipeFormState({}));
    expect(result.current.title).toBe('');
    expect(result.current.servings).toBe('1');
    expect(result.current.ingredients).toEqual([]);
    expect(result.current.steps).toEqual([]);
  });

  it('parses the servings string to a number in the payload (and falls back to 1)', () => {
    const { result } = renderHook(() => useRecipeFormState({}));
    act(() => result.current.setServings('6'));
    expect(result.current.getFormData().servings).toBe(6);

    act(() => result.current.setServings(''));
    expect(result.current.getFormData().servings).toBe(1);
  });

  it('parses ingredient amountText (fractions) and strips internal-only fields in the payload', () => {
    const { result } = renderHook(() => useRecipeFormState({}));
    act(() => result.current.addIngredient());
    act(() => result.current.updateIngredient(0, 'name', 'Butter'));
    act(() => result.current.updateIngredient(0, 'amountText', '1 1/2'));

    const ing = result.current.getFormData().ingredients[0];
    expect(ing.amount).toBe(1.5);
    expect(ing.name).toBe('Butter');
    expect('amountText' in ing).toBe(false);
    expect('internalId' in ing).toBe(false);
  });

  it('renumbers orderIndex on removal and in the payload', () => {
    const { result } = renderHook(() => useRecipeFormState({}));
    act(() => result.current.addStep());
    act(() => result.current.addStep());
    act(() => result.current.addStep());
    expect(result.current.steps.map((s) => s.orderIndex)).toEqual([0, 1, 2]);

    act(() => result.current.removeStep(0));
    expect(result.current.steps.map((s) => s.orderIndex)).toEqual([0, 1]);

    const payloadSteps = result.current.getFormData().steps;
    expect(payloadSteps.map((s) => s.orderIndex)).toEqual([0, 1]);
    // internal-only fields stripped
    expect(payloadSteps.every((s) => !('internalId' in s) && !('timeMinutesText' in s) && !('existingId' in s))).toBe(true);
  });

  it('renumbers ingredient orderIndex on removal', () => {
    const { result } = renderHook(() => useRecipeFormState({}));
    act(() => result.current.addIngredient());
    act(() => result.current.addIngredient());
    act(() => result.current.addIngredient());
    act(() => result.current.removeIngredient(1));
    expect(result.current.ingredients.map((i) => i.orderIndex)).toEqual([0, 1]);
  });
});
