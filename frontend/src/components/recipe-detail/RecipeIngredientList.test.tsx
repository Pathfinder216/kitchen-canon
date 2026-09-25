import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { RecipeIngredientList } from './RecipeIngredientList';
import type { Ingredient } from '../../types/recipe';

vi.mock('../../api/preferences', async () => {
  const actual = await vi.importActual<typeof import('../../api/preferences')>('../../api/preferences');
  return {
    ...actual,
    fetchPreferences: vi.fn(async () => ({ unitSystem: 'original', locale: 'en-US', theme: 'light' })),
  };
});

import { fetchPreferences } from '../../api/preferences';
const mockFetchPreferences = fetchPreferences as ReturnType<typeof vi.fn>;

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

  it('shows authored units for the original preference', async () => {
    mockFetchPreferences.mockResolvedValue({ unitSystem: 'original', locale: 'en-US', theme: 'light' });
    renderList([makeIngredient({ name: 'Milk', amount: 0.5, unit: 'cup' })]);
    await waitFor(() => expect(mockFetchPreferences).toHaveBeenCalled());
    expect(screen.getByText(/½ cup/)).toBeInTheDocument();
  });

  it('converts quantities for a metric user (count units untouched)', async () => {
    mockFetchPreferences.mockResolvedValue({ unitSystem: 'metric', locale: 'en-US', theme: 'light' });
    renderList([
      makeIngredient({ id: 'a', name: 'Milk', amount: 0.5, unit: 'cup' }),
      makeIngredient({ id: 'b', name: 'Garlic', amount: 2, unit: 'clove' }),
    ]);
    expect(await screen.findByText(/120 ml/)).toBeInTheDocument();
    expect(screen.getByText(/2 clove/)).toBeInTheDocument();
  });
});
