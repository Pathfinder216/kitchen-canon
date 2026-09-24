import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../test/utils';
import { MealPlanTimelinePage } from './MealPlanTimelinePage';
import type { CookingTimeline, MealPlanDetail } from '../types/meal-plan';

vi.mock('../api/meal-plans', () => ({
  fetchMealPlan: vi.fn(),
  fetchMealPlanTimeline: vi.fn(),
}));

import { fetchMealPlan, fetchMealPlanTimeline } from '../api/meal-plans';
const mockFetchMealPlan = fetchMealPlan as ReturnType<typeof vi.fn>;
const mockFetchTimeline = fetchMealPlanTimeline as ReturnType<typeof vi.fn>;

/** ISO string for a local wall-clock time on 2026-03-14. */
function at(h: number, m = 0, day = 14): string {
  return new Date(2026, 2, day, h, m).toISOString();
}

const plan = {
  id: 'p1',
  name: 'Sunday dinner',
  date: '2026-03-14',
  time: '18:00',
  notes: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  dietaryInfo: null,
  groceryList: [],
  recipes: [
    { id: 'mr-roast', mealPlanId: 'p1', recipeId: 'r-roast', recipeVersion: 1, servings: 6, orderIndex: 0, substitutions: null, recipe: { id: 'r-roast', title: 'Roast chicken', servings: 4, totalTime: null, activeTime: null, ingredients: [], steps: [] } },
    { id: 'mr-salad', mealPlanId: 'p1', recipeId: 'r-salad', recipeVersion: 1, servings: 2, orderIndex: 1, substitutions: null, recipe: { id: 'r-salad', title: 'Green salad', servings: 2, totalTime: null, activeTime: null, ingredients: [], steps: [] } },
  ],
} as unknown as MealPlanDetail;

const timeline: CookingTimeline = {
  serveAt: at(18),
  start: at(16, 5),
  entries: [
    { itemId: 'mr-roast', recipeId: 'r-roast', stepId: 's1', stepIndex: 0, start: at(16, 5), end: at(16, 20), isActive: true, untimed: false, label: 'Season the chicken' },
    { itemId: 'mr-roast', recipeId: 'r-roast', stepId: 's2', stepIndex: 1, start: at(16, 20), end: at(17, 50), isActive: false, untimed: false, label: 'Roast' },
    { itemId: 'mr-salad', recipeId: 'r-salad', stepId: 's3', stepIndex: 0, start: at(17, 30), end: at(17, 40), isActive: true, untimed: false, label: 'Chop' },
    { itemId: 'mr-salad', recipeId: 'r-salad', stepId: 's4', stepIndex: 1, start: at(17, 40), end: at(17, 45), isActive: true, untimed: true, label: 'Dress' },
    { itemId: 'mr-roast', recipeId: 'r-roast', stepId: 's5', stepIndex: 2, start: at(17, 50), end: at(18), isActive: true, untimed: false, label: 'Carve' },
  ],
  recipes: [
    { itemId: 'mr-roast', recipeId: 'r-roast', title: 'Roast chicken', start: at(16, 5), end: at(18) },
    { itemId: 'mr-salad', recipeId: 'r-salad', title: 'Green salad', start: at(17, 30), end: at(17, 45) },
  ],
  warnings: [
    { type: 'untimed-steps', itemId: 'mr-salad', recipeId: 'r-salad', stepIds: ['s4'], message: '"Green salad" has 1 untimed step; assumed 5 min for active and 0 min for passive steps.' },
  ],
  makeAhead: [
    { itemId: 'mr-roast', recipeId: 'r-roast', stepId: 's0', reason: 'long-passive-step', leadMinutes: 900, startBy: at(3), message: '"Roast chicken" has a 12 h passive step ("Brine") — consider making it ahead, e.g. the evening before.' },
  ],
};

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/meal-plans/:id/timeline" element={<MealPlanTimelinePage />} />
    </Routes>,
    { route: '/meal-plans/p1/timeline' },
  );
}

beforeEach(() => {
  mockFetchMealPlan.mockReset().mockResolvedValue(plan);
  mockFetchTimeline.mockReset().mockResolvedValue(timeline);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MealPlanTimelinePage', () => {
  it("requests the timeline for the plan's date and time", async () => {
    renderPage();
    await screen.findByText('Season the chicken', { selector: 'p' });
    expect(mockFetchTimeline).toHaveBeenCalledWith('p1', at(18));
    expect(screen.getByLabelText(/serve at/i)).toHaveValue('2026-03-14T18:00');
  });

  it('renders make-ahead suggestions, warnings and a chronological schedule', async () => {
    renderPage();
    const makeAhead = await screen.findByTestId('make-ahead');
    expect(within(makeAhead).getByText(/12 h passive step/)).toBeInTheDocument();
    expect(screen.getByText(/1 untimed step/)).toBeInTheDocument();

    const rows = screen.getAllByTestId('schedule-entry');
    expect(rows.map((r) => within(r).getByText(/^(Season the chicken|Roast|Chop|Dress|Carve)$/, { selector: 'p' }).textContent))
      .toEqual(['Season the chicken', 'Roast', 'Chop', 'Dress', 'Carve']);
    expect(within(rows[3]).getByText(/untimed/)).toBeInTheDocument();
    expect(screen.getByTestId('timeline-chart')).toBeInTheDocument();
  });

  it('links each entry into cook mode for its recipe', async () => {
    renderPage();
    const link = await screen.findByRole('link', { name: 'Cook Green salad, step 2' });
    expect(link).toHaveAttribute('href', '/recipes/r-salad/cook');
  });

  it('refetches when the serve time changes', async () => {
    renderPage();
    const input = await screen.findByLabelText(/serve at/i);
    fireEvent.change(input, { target: { value: '2026-03-14T19:30' } });
    await waitFor(() => expect(mockFetchTimeline).toHaveBeenLastCalledWith('p1', at(19, 30)));
  });

  it('highlights the current step in live mode', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 2, 14, 17, 35));
    const user = userEvent.setup();
    renderPage();

    await screen.findAllByTestId('schedule-entry');
    expect(screen.getByTestId('now-line')).toBeInTheDocument();
    expect(screen.getByTestId('now-divider')).toBeInTheDocument();
    expect(screen.queryByTestId('live-banner')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /start cooking/i }));

    const banner = screen.getByTestId('live-banner');
    expect(banner).toHaveTextContent(/Roast chicken: Roast/);
    expect(banner).toHaveTextContent(/Green salad: Chop/);
    expect(banner).toHaveTextContent(/Next at .*Green salad — Dress/);
    const current = screen.getAllByTestId('schedule-entry').filter((r) => r.getAttribute('aria-current') === 'step');
    expect(current.map((r) => within(r).getByText(/^(Roast|Chop)$/).textContent)).toEqual(['Roast', 'Chop']);
  });

  it('hides the now line when the serve time is not today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 2, 10, 12, 0));
    renderPage();
    await screen.findAllByTestId('schedule-entry');
    expect(screen.queryByTestId('now-line')).not.toBeInTheDocument();
    expect(screen.queryByTestId('now-divider')).not.toBeInTheDocument();
  });
});
