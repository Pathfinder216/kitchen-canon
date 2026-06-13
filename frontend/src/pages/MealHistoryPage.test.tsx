import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import { MealHistoryPage } from './MealHistoryPage';

vi.mock('../api/meal-plans', () => ({
  fetchMealPlans: vi.fn(),
}));

import { fetchMealPlans } from '../api/meal-plans';
const mockFetchMealPlans = fetchMealPlans as ReturnType<typeof vi.fn>;

function renderPage() {
  return renderWithProviders(<MealHistoryPage />);
}

describe('MealHistoryPage', () => {
  it('shows loading state initially', () => {
    mockFetchMealPlans.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows empty state when no plans', async () => {
    mockFetchMealPlans.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/no meal plans yet/i)).toBeInTheDocument();
  });

  it('shows empty state on fetch error (not a failure message)', async () => {
    mockFetchMealPlans.mockRejectedValue(new Error('Network error'));
    renderPage();
    expect(await screen.findByText(/no meal plans yet/i)).toBeInTheDocument();
  });

  it('renders a list of meal plans', async () => {
    mockFetchMealPlans.mockResolvedValue([
      {
        id: 'p1',
        name: 'Week 1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        recipes: [
          { id: 'mr1', recipe: { id: 'r1', title: 'Pasta', servings: 4 } },
        ],
      },
    ]);
    renderPage();
    expect(await screen.findByText('Week 1')).toBeInTheDocument();
    expect(screen.getByText('Pasta')).toBeInTheDocument();
    expect(screen.getByText(/1 recipe/)).toBeInTheDocument();
  });

  it('shows "New Plan" link', () => {
    mockFetchMealPlans.mockResolvedValue([]);
    renderPage();
    expect(screen.getByRole('link', { name: /new plan/i })).toBeInTheDocument();
  });
});
