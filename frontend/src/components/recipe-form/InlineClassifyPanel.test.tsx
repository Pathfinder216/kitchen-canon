import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InlineClassifyPanel } from './InlineClassifyPanel';

vi.mock('../../api/ingredients', () => ({
  createIngredientEntry: vi.fn().mockResolvedValue({}),
  suggestIngredients: vi.fn().mockResolvedValue([]),
  fetchIngredients: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../api/nutrition', async () => ({
  ...(await vi.importActual<typeof import('../../api/nutrition')>('../../api/nutrition')),
  fetchNutritionStatus: vi.fn().mockResolvedValue({ lookupConfigured: false }),
  searchNutrition: vi.fn(),
  fetchFdcFood: vi.fn(),
}));
vi.mock('../../hooks/useDietaryTags', () => ({
  useDietaryTags: () => ({ allergens: [], diets: [], allergenLabels: {}, dietLabels: {} }),
}));

import { createIngredientEntry, fetchIngredients, suggestIngredients, type CatalogEntry } from '../../api/ingredients';
import type { Nutrition } from '../../api/nutrition';

const yogurtNutrition: Nutrition = {
  per100g: { calories: 73, protein: 9.95 },
  gramsPerUnit: { container: 200 },
  source: 'fdc',
  fdcId: 170903,
  fdcDescription: 'Yogurt, Greek, plain, lowfat',
};

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
      { id: 'c1', displayAlias: 'chicken', allergens: [], diets: ['gluten_free'], aisle: 'meat-seafood', nutrition: null, score: 0.8 },
      { id: 'c2', displayAlias: 'chicken breast', allergens: ['soy'], diets: [], aisle: null, nutrition: null, score: 0.8 },
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

  it('copy-from-similar: one tap on a match prefills tags and nutrition, saved as copied', async () => {
    vi.mocked(suggestIngredients).mockResolvedValue([
      { id: 'y1', displayAlias: 'greek yogurt', allergens: ['dairy'], diets: ['vegetarian'], aisle: 'dairy-eggs', nutrition: yogurtNutrition, score: 0.8 },
    ]);
    const user = userEvent.setup();
    const { onSaved } = renderPanel('r1', 'greek yoghurt');

    // Two taps: the match, then Save.
    await user.click(await screen.findByRole('button', { name: 'greek yogurt' }));
    expect(screen.getByText(/Tags and nutrition copied from "greek yogurt"/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nutrition.*copied from a similar ingredient/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createIngredientEntry).toHaveBeenCalledWith({
      name: 'greek yoghurt',
      allergens: ['dairy'],
      diets: ['vegetarian'],
      aisle: 'dairy-eggs',
      nutrition: { ...yogurtNutrition, source: 'copied' },
    });
  });

  it('copy-from-similar: any catalog entry can be picked from the combo box and edited before save', async () => {
    const skyr: CatalogEntry = {
      id: 's1', displayAlias: 'skyr', allergens: ['dairy'], diets: [], aisle: null,
      nutrition: { per100g: { calories: 63 }, source: 'manual' },
      isUserAdded: true, userId: 'u', aliases: [],
    };
    vi.mocked(fetchIngredients).mockResolvedValue([skyr]);
    Element.prototype.scrollIntoView ??= vi.fn(); // jsdom lacks it; ComboInput scrolls the highlight
    const user = userEvent.setup();
    const { onSaved } = renderPanel(undefined, 'quark');

    await user.type(await screen.findByLabelText('Copy from'), 'sky');
    await user.click(await screen.findByText('skyr'));
    await user.click(screen.getByRole('button', { name: /Nutrition/ }));
    const calories = screen.getByLabelText('Calories (kcal)');
    expect(calories).toHaveValue(63);
    await user.clear(calories);
    await user.type(calories, '70');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createIngredientEntry).toHaveBeenCalledWith({
      name: 'quark',
      allergens: ['dairy'],
      diets: [],
      // Hand-edited after copying, so the numbers are now the user's own.
      nutrition: { per100g: { calories: 70 }, source: 'manual' },
    });
  });
});
