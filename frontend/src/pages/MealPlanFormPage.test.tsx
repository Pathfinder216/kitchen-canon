import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../test/utils';
import { MealPlanFormPage } from './MealPlanFormPage';
import type { Recipe } from '../types/recipe';
import type { MealPlanDetail } from '../types/meal-plan';

// ── Mock the API modules the page (and its hooks) reach through ────────────────
vi.mock('../api/recipes', () => ({
  fetchRecipes: vi.fn(),
  fetchRecipe: vi.fn(),
}));
vi.mock('../api/meal-plans', () => ({
  fetchMealPlan: vi.fn(),
  createMealPlan: vi.fn(),
  updateMealPlan: vi.fn(),
}));
vi.mock('../api/substitutions', () => ({
  fetchSubstitutionsForRecipe: vi.fn(),
}));

import { fetchRecipes, fetchRecipe } from '../api/recipes';
import { fetchMealPlan, createMealPlan, updateMealPlan } from '../api/meal-plans';
import { fetchSubstitutionsForRecipe } from '../api/substitutions';

const mockFetchRecipes = fetchRecipes as ReturnType<typeof vi.fn>;
const mockFetchRecipe = fetchRecipe as ReturnType<typeof vi.fn>;
const mockFetchMealPlan = fetchMealPlan as ReturnType<typeof vi.fn>;
const mockCreateMealPlan = createMealPlan as ReturnType<typeof vi.fn>;
const mockUpdateMealPlan = updateMealPlan as ReturnType<typeof vi.fn>;
const mockFetchSubs = fetchSubstitutionsForRecipe as ReturnType<typeof vi.fn>;

// ── Helpers to build fixtures ─────────────────────────────────────────────────
function makeRecipe(over: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    title: 'Pasta',
    servings: 4,
    totalTime: 30,
    activeTime: 15,
    source: null,
    archived: false,
    createdAt: '',
    updatedAt: '',
    version: 1,
    parentId: null,
    isLatest: true,
    authorNotes: null,
    personalNotes: null,
    ingredients: [
      { id: 'i1', recipeId: 'r1', name: 'flour', originalName: null, amount: 2, unit: 'cup', isOptional: false, orderIndex: 0 },
    ],
    steps: [],
    courses: [],
    labels: [],
    ...over,
  };
}

function paginated(recipes: Recipe[]) {
  return { recipes, pagination: { page: 1, limit: 20, total: recipes.length, totalPages: 1 } };
}

function makePlan(over: Partial<MealPlanDetail> = {}): MealPlanDetail {
  return {
    id: 'p1',
    name: 'Sunday Dinner',
    date: '2026-06-20',
    time: '18:00',
    notes: 'Family meal',
    createdAt: '',
    updatedAt: '',
    dietaryInfo: null,
    groceryList: [],
    recipes: [
      {
        id: 'mr1',
        mealPlanId: 'p1',
        recipeId: 'r1',
        recipeVersion: 1,
        servings: 6,
        orderIndex: 0,
        substitutions: null,
        recipe: {
          id: 'r1',
          title: 'Pasta',
          servings: 4,
          totalTime: 30,
          activeTime: 15,
          ingredients: [],
          steps: [],
        },
      },
    ],
    ...over,
  };
}

// Cover-photo + /api/meta requests go through raw fetch — stub them empty.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/meta')) {
      return new Response(JSON.stringify({ allergens: [], diets: [], allergenLabels: {}, dietLabels: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // cover-photo media lookups
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  mockFetchSubs.mockResolvedValue([]);
  mockFetchRecipes.mockResolvedValue(paginated([makeRecipe()]));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderNew() {
  return renderWithProviders(
    <Routes>
      <Route path="/meal-plans/new" element={<MealPlanFormPage />} />
      <Route path="/meal-plans/:id" element={<div>Plan Detail Page</div>} />
    </Routes>,
    { route: '/meal-plans/new' },
  );
}

function renderEdit(id = 'p1') {
  return renderWithProviders(
    <Routes>
      <Route path="/meal-plans/:id/edit" element={<MealPlanFormPage />} />
      <Route path="/meal-plans/:id" element={<div>Plan Detail Page</div>} />
    </Routes>,
    { route: `/meal-plans/${id}/edit` },
  );
}

describe('MealPlanFormPage (characterization)', () => {
  it('loads an existing plan into the form (edit mode)', async () => {
    mockFetchMealPlan.mockResolvedValue(makePlan());
    renderEdit();

    expect(await screen.findByText('Edit Meal Plan')).toBeInTheDocument();
    expect((screen.getByLabelText(/Name/i) as HTMLInputElement).value).toBe('Sunday Dinner');
    expect((screen.getByLabelText(/Date/i) as HTMLInputElement).value).toBe('2026-06-20');
    expect((screen.getByLabelText(/Time/i) as HTMLInputElement).value).toBe('18:00');
    expect((screen.getByLabelText(/Notes/i) as HTMLInputElement).value).toBe('Family meal');

    // The pre-selected recipe shows in the "Meal" panel with its saved servings (6).
    expect(screen.getByText('Meal (1)')).toBeInTheDocument();
    const servingsInput = screen.getByLabelText(/^Servings:$/i) as HTMLInputElement;
    expect(servingsInput.value).toBe('6');
  });

  it('renders candidate recipes returned by the (server-filtered) recipe query', async () => {
    mockFetchMealPlan.mockResolvedValue(undefined);
    mockFetchRecipes.mockResolvedValue(paginated([
      makeRecipe({ id: 'r1', title: 'Pasta' }),
      makeRecipe({ id: 'r2', title: 'Salad' }),
    ]));
    renderNew();

    expect(await screen.findByText('Pasta')).toBeInTheDocument();
    expect(screen.getByText('Salad')).toBeInTheDocument();
  });

  it('dietary filter narrows the candidate list (non-matching recipe hidden)', async () => {
    mockFetchMealPlan.mockResolvedValue(undefined);
    // First (unfiltered) load returns both; a refetch with a diet filter returns only Salad.
    mockFetchRecipes
      .mockResolvedValueOnce(paginated([
        makeRecipe({ id: 'r1', title: 'Pasta' }),
        makeRecipe({ id: 'r2', title: 'Salad' }),
      ]))
      .mockResolvedValue(paginated([makeRecipe({ id: 'r2', title: 'Salad' })]));
    renderNew();

    expect(await screen.findByText('Pasta')).toBeInTheDocument();

    // Drive the search box (a filter input) to trigger a refetch with narrowed params.
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/Search recipes/i), 'salad');

    await waitFor(() => expect(screen.queryByText('Pasta')).not.toBeInTheDocument());
    expect(screen.getByText('Salad')).toBeInTheDocument();
    // The narrowing went through the recipe query (server-side filter).
    expect(mockFetchRecipes).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'salad' }),
    );
  });

  it('selecting a recipe adds it to the meal with a servings input', async () => {
    mockFetchMealPlan.mockResolvedValue(undefined);
    renderNew();

    const user = userEvent.setup();
    const pastaCard = (await screen.findByText('Pasta')).closest('div')!;
    const addBtn = within(pastaCard.parentElement!).getByRole('button', { name: /Add Pasta/i });
    await user.click(addBtn);

    expect(await screen.findByText('Meal (1)')).toBeInTheDocument();
    const servingsInput = screen.getByLabelText(/^Servings:$/i) as HTMLInputElement;
    // Defaults to the recipe's default servings (4).
    expect(servingsInput.value).toBe('4');
  });

  it('submit posts the expected payload shape (create)', async () => {
    mockFetchMealPlan.mockResolvedValue(undefined);
    mockCreateMealPlan.mockResolvedValue(makePlan({ id: 'new1' }));
    renderNew();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Name/i), 'My Plan');

    const pastaCard = (await screen.findByText('Pasta')).closest('div')!;
    await user.click(within(pastaCard.parentElement!).getByRole('button', { name: /Add Pasta/i }));

    await user.click(screen.getByRole('button', { name: /Create Meal Plan/i }));

    await waitFor(() => expect(mockCreateMealPlan).toHaveBeenCalledTimes(1));
    expect(mockCreateMealPlan).toHaveBeenCalledWith({
      name: 'My Plan',
      date: undefined,
      time: undefined,
      notes: undefined,
      recipes: [
        { recipeId: 'r1', servings: 4, orderIndex: 0, substitutions: undefined },
      ],
    });
    // Navigates to the created plan's detail page.
    expect(await screen.findByText('Plan Detail Page')).toBeInTheDocument();
  });

  it('submit on edit calls update and navigates back to detail', async () => {
    mockFetchMealPlan.mockResolvedValue(makePlan());
    mockUpdateMealPlan.mockResolvedValue(makePlan());
    renderEdit();

    await screen.findByText('Edit Meal Plan');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => expect(mockUpdateMealPlan).toHaveBeenCalledTimes(1));
    const [id, input] = mockUpdateMealPlan.mock.calls[0];
    expect(id).toBe('p1');
    expect(input).toMatchObject({
      name: 'Sunday Dinner',
      recipes: [{ recipeId: 'r1', servings: 6, orderIndex: 0 }],
    });
    expect(await screen.findByText('Plan Detail Page')).toBeInTheDocument();
  });
});
