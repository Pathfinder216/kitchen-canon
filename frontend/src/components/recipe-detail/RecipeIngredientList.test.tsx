import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { RecipeIngredientList } from './RecipeIngredientList';
import type { Ingredient } from '../../types/recipe';

function makeIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    id: 'i1', recipeId: 'r1', name: 'Cheese', originalName: null,
    amount: 2, unit: 'slice', isOptional: false, note: null, orderIndex: 0,
    ...overrides,
  };
}

function renderList(ingredients: Ingredient[]) {
  return renderWithProviders(
    <RecipeIngredientList
      ingredients={ingredients}
      scaledIngredients={ingredients}
      activeSwaps={{}}
      subsByIngredientId={{}}
      onApplySwap={vi.fn()}
      onRemoveSwap={vi.fn()}
      onClearSwaps={vi.fn()}
    />,
  );
}

describe('RecipeIngredientList', () => {
  it('renders an ingredient note as muted text after the name', () => {
    renderList([makeIngredient({ note: 'use Cooper brand' })]);
    expect(screen.getByText('— use Cooper brand')).toBeInTheDocument();
  });

  it('renders no note text when the ingredient has none', () => {
    renderList([makeIngredient({ note: null })]);
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });
});
