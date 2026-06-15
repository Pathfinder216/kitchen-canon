import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../test/utils';
import { RecipeDetailPage } from './RecipeDetailPage';

// --- API mocks (keep the page off the network) ---------------------------------
vi.mock('../api/recipes', () => ({
  fetchRecipe: vi.fn(),
  archiveRecipe: vi.fn(),
  deleteRecipePermanently: vi.fn(),
}));
vi.mock('../api/substitutions', () => ({
  fetchSubstitutionsForRecipe: vi.fn(),
}));
vi.mock('../api/client', () => ({
  apiGet: vi.fn(),
}));
vi.mock('../hooks/useDietaryTags', () => ({
  useDietaryTags: () => ({ allergenLabels: {}, dietLabels: {} }),
}));
// Media components hit raw fetch — stub them out so they render nothing.
vi.mock('../components/RecipeMedia', () => ({ RecipeMedia: () => null }));
vi.mock('../components/StepMedia', () => ({ StepMedia: () => null }));
vi.mock('../utils/exportRecipe', () => ({
  exportRecipeAsText: vi.fn(),
  exportRecipeAsJson: vi.fn(),
}));

import { fetchRecipe, archiveRecipe } from '../api/recipes';
import { fetchSubstitutionsForRecipe } from '../api/substitutions';
import { apiGet } from '../api/client';
import { exportRecipeAsText } from '../utils/exportRecipe';

const mockFetchRecipe = fetchRecipe as ReturnType<typeof vi.fn>;
const mockArchiveRecipe = archiveRecipe as ReturnType<typeof vi.fn>;
const mockFetchSubs = fetchSubstitutionsForRecipe as ReturnType<typeof vi.fn>;
const mockApiGet = apiGet as ReturnType<typeof vi.fn>;
const mockExportText = exportRecipeAsText as ReturnType<typeof vi.fn>;

const mockRecipe = {
  id: 'r1',
  title: 'Test Recipe',
  servings: 4,
  totalTime: 30,
  activeTime: 15,
  archived: false,
  version: 1,
  parentId: null,
  isLatest: true,
  source: null,
  authorNotes: null,
  personalNotes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ingredients: [
    { id: 'i1', recipeId: 'r1', name: 'Flour', amount: 2, unit: 'cups', isOptional: false, orderIndex: 0, originalName: null },
    { id: 'i2', recipeId: 'r1', name: 'Sugar', amount: 1, unit: 'cup', isOptional: false, orderIndex: 1, originalName: null },
  ],
  steps: [
    { id: 's1', recipeId: 'r1', orderIndex: 0, instruction: 'Mix everything together', timeMinutes: 5, isActiveTime: true },
    { id: 's2', recipeId: 'r1', orderIndex: 1, instruction: 'Bake it', timeMinutes: null, isActiveTime: false },
  ],
  courses: [],
  labels: [],
};

function renderPage(id = 'r1') {
  return renderWithProviders(
    <Routes>
      <Route path="/recipes/:id" element={<RecipeDetailPage />} />
    </Routes>,
    { route: `/recipes/${id}` },
  );
}

describe('RecipeDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRecipe.mockResolvedValue(mockRecipe);
    mockFetchSubs.mockResolvedValue([]);
    mockApiGet.mockResolvedValue({ allergens: [], diets: [], unknownIngredients: [] });
    mockArchiveRecipe.mockResolvedValue(mockRecipe);
    mockExportText.mockReturnValue(undefined);
  });

  it('renders title, ingredients, and steps from the recipe', async () => {
    renderPage();
    // The title appears in both the screen and print layouts.
    expect((await screen.findAllByRole('heading', { name: 'Test Recipe', level: 1 })).length).toBeGreaterThan(0);
    // Ingredient names (rendered both in screen + print layouts)
    expect(screen.getAllByText('Flour').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sugar').length).toBeGreaterThan(0);
    // Steps
    expect(screen.getAllByText('Mix everything together').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bake it').length).toBeGreaterThan(0);
  });

  it('renders ingredient names without the alias parenthetical', async () => {
    mockFetchRecipe.mockResolvedValue({
      ...mockRecipe,
      ingredients: [
        { id: 'i1', recipeId: 'r1', name: 'cilantro', amount: 1, unit: 'cup', isOptional: false, orderIndex: 0, originalName: null },
      ],
    });
    renderPage();
    await screen.findAllByRole('heading', { name: 'Test Recipe', level: 1 });

    expect(screen.getAllByText('cilantro').length).toBeGreaterThan(0);
    // The on-screen recipe ingredient list must not append "(coriander)".
    expect(screen.queryByText(/\(coriander\)/)).not.toBeInTheDocument();
  });

  it('doubles displayed ingredient amounts when servings are doubled', async () => {
    renderPage();
    await screen.findAllByRole('heading', { name: 'Test Recipe', level: 1 });

    // At default 4 servings: 2 cups flour (appears in both screen + print layouts).
    expect(screen.getAllByText(/2 cups/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/4 cups/).length).toBe(0);

    const input = screen.getByLabelText('Servings:') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8' } });

    // Doubled: 2 -> 4 cups flour, 1 -> 2 cups sugar
    expect(screen.getAllByText(/4 cups/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2 cup\b/).length).toBeGreaterThan(0);
  });

  it('calls the archive mutation when Archive is clicked', async () => {
    renderPage();
    await screen.findAllByRole('heading', { name: 'Test Recipe', level: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(mockArchiveRecipe).toHaveBeenCalledWith('r1'));
  });

  it('triggers a text export from the export button', async () => {
    renderPage();
    await screen.findAllByRole('heading', { name: 'Test Recipe', level: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Export .txt' }));
    expect(mockExportText).toHaveBeenCalledTimes(1);
    // First arg is the recipe
    expect(mockExportText.mock.calls[0][0]).toMatchObject({ id: 'r1', title: 'Test Recipe' });
  });

  it('opens the delete confirmation modal', async () => {
    renderPage();
    await screen.findAllByRole('heading', { name: 'Test Recipe', level: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete recipe?')).toBeInTheDocument();
  });
});
