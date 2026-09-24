import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';
import { ClassifyIngredientsPanel } from './ClassifyIngredientsPanel';

vi.mock('../api/ingredients', () => ({
  createIngredientEntry: vi.fn().mockResolvedValue({}),
  suggestIngredients: vi.fn(),
}));
vi.mock('../hooks/useDietaryTags', () => ({
  useDietaryTags: () => ({ allergens: [], diets: [], allergenLabels: {}, dietLabels: {} }),
}));

import { createIngredientEntry, suggestIngredients } from '../api/ingredients';

describe('ClassifyIngredientsPanel suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(suggestIngredients).mockImplementation(async (name: string) =>
      name === 'tomatos'
        ? [{ id: 't1', displayAlias: 'tomatoes', allergens: [], diets: ['vegan'], aisle: 'produce', score: 0.82 }]
        : [],
    );
  });

  it('prefills only the ingredient whose suggestion was tapped', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    renderWithProviders(<ClassifyIngredientsPanel unknownIngredients={['tomatos', 'mystery']} onDone={onDone} />);

    await user.click(await screen.findByRole('button', { name: 'tomatoes' }));
    await user.click(screen.getByRole('button', { name: 'Save & recalculate' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(createIngredientEntry).toHaveBeenCalledWith({ name: 'tomatos', allergens: [], diets: ['vegan'], aisle: 'produce' });
    expect(createIngredientEntry).toHaveBeenCalledWith({ name: 'mystery', allergens: [], diets: [] });
  });
});
