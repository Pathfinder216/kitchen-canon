import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/utils';
import { NutritionEditor } from './NutritionEditor';
import { draftToNutrition, emptyNutritionDraft, type NutritionDraft } from '../../utils/nutrition';
import type { FdcMatch } from '../../api/nutrition';

vi.mock('../../api/nutrition', async () => ({
  ...(await vi.importActual<typeof import('../../api/nutrition')>('../../api/nutrition')),
  fetchNutritionStatus: vi.fn(),
  searchNutrition: vi.fn(),
  fetchFdcFood: vi.fn(),
}));

import { fetchFdcFood, fetchNutritionStatus, searchNutrition } from '../../api/nutrition';

const yogurtMatch: FdcMatch = {
  fdcId: 170903,
  description: 'Yogurt, Greek, plain, lowfat',
  dataType: 'SR Legacy',
  foodCategory: 'Dairy and Egg Products',
  nutrition: {
    per100g: { calories: 73, protein: 9.95, fat: 1.92, sodium: 34 },
    source: 'fdc',
    fdcId: 170903,
    fdcDescription: 'Yogurt, Greek, plain, lowfat',
  },
};
const yogurtDetail: FdcMatch = {
  ...yogurtMatch,
  nutrition: { ...yogurtMatch.nutrition, gramsPerUnit: { container: 200 } },
};

/** Renders the editor with real parent state and exposes the latest draft. */
function renderEditor(initial: NutritionDraft = emptyNutritionDraft()) {
  const latest: { draft: NutritionDraft } = { draft: initial };
  function Harness() {
    const [draft, setDraft] = useState(initial);
    latest.draft = draft;
    return <NutritionEditor ingredientName="greek yogurt" value={draft} onChange={setDraft} />;
  }
  renderWithProviders(<Harness />);
  return latest;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchNutritionStatus).mockResolvedValue({ lookupConfigured: true });
});

describe('NutritionEditor', () => {
  it('looks up USDA matches and prefills per-100 g values plus portions from the picked food', async () => {
    vi.mocked(searchNutrition).mockResolvedValue([yogurtMatch]);
    vi.mocked(fetchFdcFood).mockResolvedValue(yogurtDetail);
    const user = userEvent.setup();
    const latest = renderEditor();

    await user.click(screen.getByRole('button', { name: /nutrition/i }));
    await user.click(await screen.findByRole('button', { name: 'Look up nutrition' }));
    expect(searchNutrition).toHaveBeenCalledWith('greek yogurt');

    await user.click(await screen.findByRole('button', { name: /Yogurt, Greek, plain, lowfat.*73 kcal\/100g/ }));
    expect(fetchFdcFood).toHaveBeenCalledWith(170903);

    await waitFor(() => expect(screen.getByLabelText('Calories (kcal)')).toHaveValue(73));
    expect(screen.getByLabelText('Protein (g)')).toHaveValue(9.95);
    expect(screen.getByText(/1 container = 200 g/)).toBeInTheDocument();
    expect(screen.getByText('USDA match: Yogurt, Greek, plain, lowfat')).toBeInTheDocument();
    expect(draftToNutrition(latest.draft)).toEqual(yogurtDetail.nutrition);
  });

  it('keeps the search result values when the portion lookup fails', async () => {
    vi.mocked(searchNutrition).mockResolvedValue([yogurtMatch]);
    vi.mocked(fetchFdcFood).mockRejectedValue(new Error('502'));
    const user = userEvent.setup();
    const latest = renderEditor();

    await user.click(screen.getByRole('button', { name: /nutrition/i }));
    await user.click(await screen.findByRole('button', { name: 'Look up nutrition' }));
    await user.click(await screen.findByRole('button', { name: /Yogurt, Greek/ }));

    expect(await screen.findByText(/Could not load serving sizes/)).toBeInTheDocument();
    expect(draftToNutrition(latest.draft)).toEqual(yogurtMatch.nutrition);
  });

  it('hides the lookup when the server has no FDC key; manual entry still works', async () => {
    vi.mocked(fetchNutritionStatus).mockResolvedValue({ lookupConfigured: false });
    const user = userEvent.setup();
    const latest = renderEditor();

    await user.click(screen.getByRole('button', { name: /nutrition/i }));
    expect(await screen.findByText(/lookup not configured/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Look up nutrition' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Calories (kcal)'), '59');
    expect(draftToNutrition(latest.draft)).toEqual({ per100g: { calories: 59 }, source: 'manual' });
  });

  it('shows the lookup error readably', async () => {
    vi.mocked(searchNutrition).mockRejectedValue(new Error('USDA FoodData Central lookup failed: its rate limit was reached — try again later.'));
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: /nutrition/i }));
    await user.click(await screen.findByRole('button', { name: 'Look up nutrition' }));
    expect(await screen.findByText(/rate limit was reached/)).toBeInTheDocument();
  });
});
