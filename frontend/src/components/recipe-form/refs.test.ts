import { describe, it, expect } from 'vitest';
import { getRefUsage, getOverReferencedIngredients, getUnderReferencedIngredients } from './refs';
import type { IngredientFormItem, StepFormItem } from './useRecipeFormState';

function steps(...instructions: string[]): StepFormItem[] {
  return instructions.map((instruction, i) => ({
    internalId: `s${i}`, orderIndex: i, instruction, isActiveTime: true, timeMinutes: 0, timeMinutesText: '0',
  }));
}

const butter = { name: 'butter', amountText: '4', internalId: 'i1', isOptional: false, orderIndex: 0 } as IngredientFormItem;

describe('getRefUsage (remaining-percent semantics)', () => {
  it('counts a bare ref as the remainder, not 100%', () => {
    expect(getRefUsage(steps('{butter:50%}', '{butter}'))).toEqual({ butter: 100 });
  });

  it('treats an explicit split plus a bare finish as fully referenced', () => {
    const s = steps('{butter:30%}', '{butter:30%}', '{butter}');
    expect(getOverReferencedIngredients(s)).toEqual([]);
    expect(getUnderReferencedIngredients([butter], s)).toEqual([]);
  });

  it('still flags explicit over-consumption', () => {
    expect(getOverReferencedIngredients(steps('{butter:80%}', '{butter:40%}'))).toEqual(['butter (120%)']);
  });

  it('flags a bare ref that has nothing left', () => {
    expect(getOverReferencedIngredients(steps('{butter}', '{butter}'))).toEqual(['butter (a bare {butter} has nothing left)']);
  });
});
