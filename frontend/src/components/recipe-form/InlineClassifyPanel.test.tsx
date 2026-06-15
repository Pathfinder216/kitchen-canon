import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InlineClassifyPanel } from './InlineClassifyPanel';

vi.mock('../../api/ingredients', () => ({
  createIngredientEntry: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../hooks/useDietaryTags', () => ({
  useDietaryTags: () => ({ allergens: [], diets: [], allergenLabels: {}, dietLabels: {} }),
}));

import { createIngredientEntry } from '../../api/ingredients';

function renderPanel(recipeId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(queryClient, 'invalidateQueries');
  const onSaved = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <InlineClassifyPanel ingredientName="sausage" recipeId={recipeId} onSaved={onSaved} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
  return { spy, onSaved };
}

describe('InlineClassifyPanel', () => {
  beforeEach(() => vi.clearAllMocks());

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
});
