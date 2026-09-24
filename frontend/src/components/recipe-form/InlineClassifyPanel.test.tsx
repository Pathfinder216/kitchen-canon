import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InlineClassifyPanel } from './InlineClassifyPanel';

vi.mock('../../api/ingredients', () => ({
  createIngredientEntry: vi.fn().mockResolvedValue({}),
  suggestIngredients: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../hooks/useDietaryTags', () => ({
  useDietaryTags: () => ({ allergens: [], diets: [], allergenLabels: {}, dietLabels: {} }),
}));

import { createIngredientEntry, suggestIngredients } from '../../api/ingredients';

function renderPanel(recipeId?: string, ingredientName = 'sausage') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(queryClient, 'invalidateQueries');
  const onSaved = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <InlineClassifyPanel ingredientName={ingredientName} recipeId={recipeId} onSaved={onSaved} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
  return { spy, onSaved };
}

describe('InlineClassifyPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(suggestIngredients).mockResolvedValue([]);
  });

  it('invalidates both ingredients and recipe-dietary when editing a recipe', async () => {
    const user = userEvent.setup();
    const { spy, onSaved } = renderPanel('r1');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createIngredientEntry).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'sausage' }),
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: ['ingredients'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['recipe-dietary', 'r1'] });
  });

  it('only invalidates ingredients when there is no recipe id (create page)', async () => {
    const user = userEvent.setup();
    const { spy, onSaved } = renderPanel(undefined);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith({ queryKey: ['ingredients'] });
    expect(spy).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['recipe-dietary']) }),
    );
  });

  it('offers "Did you mean" matches and prefills tags and aisle from the one tapped', async () => {
    vi.mocked(suggestIngredients).mockResolvedValue([
      { id: 'c1', displayAlias: 'chicken', allergens: [], diets: ['gluten_free'], aisle: 'meat-seafood', score: 0.8 },
      { id: 'c2', displayAlias: 'chicken breast', allergens: ['soy'], diets: [], aisle: null, score: 0.8 },
    ]);
    const user = userEvent.setup();
    const { onSaved } = renderPanel('r1', 'Chiken');

    await user.click(await screen.findByRole('button', { name: 'chicken' }));
    expect(suggestIngredients).toHaveBeenCalledWith('chiken');
    expect(screen.getByRole('button', { name: 'chicken' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Tags copied from "chicken"/)).toBeInTheDocument();
    // Nothing is saved until the user confirms.
    expect(createIngredientEntry).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createIngredientEntry).toHaveBeenCalledWith({
      name: 'chiken',
      allergens: [],
      diets: ['gluten_free'],
      aisle: 'meat-seafood',
    });
  });

  it('shows no suggestions when there are none', async () => {
    renderPanel(undefined, 'unobtainium');
    await waitFor(() => expect(suggestIngredients).toHaveBeenCalledWith('unobtainium'));
    expect(screen.queryByText(/Did you mean/)).not.toBeInTheDocument();
  });
});
