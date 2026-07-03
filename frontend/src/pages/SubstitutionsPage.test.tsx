import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import { SubstitutionsPage } from './SubstitutionsPage';

vi.mock('../api/substitutions', () => ({
  fetchSubstitutions: vi.fn(),
  createSubstitution: vi.fn(),
  deleteSubstitution: vi.fn(),
}));

vi.mock('../hooks/useIngredients', () => ({
  useIngredientNames: () => ['butter', 'coconut oil'],
}));

import { fetchSubstitutions } from '../api/substitutions';
const mockFetchSubs = fetchSubstitutions as ReturnType<typeof vi.fn>;

describe('SubstitutionsPage', () => {
  it('hides the delete button on official substitutions but shows it on user ones', async () => {
    mockFetchSubs.mockResolvedValue([
      {
        id: 's1',
        fromIngredient: 'butter',
        toIngredient: 'coconut oil',
        ratio: 1,
        notes: null,
        isOfficial: true,
      },
      {
        id: 's2',
        fromIngredient: 'butter',
        toIngredient: 'margarine',
        ratio: 1,
        notes: null,
        isOfficial: false,
      },
    ]);
    renderWithProviders(<SubstitutionsPage />);

    expect(await screen.findByText('coconut oil')).toBeInTheDocument();
    expect(screen.getByText('margarine')).toBeInTheDocument();
    expect(screen.getByText('verified')).toBeInTheDocument();
    // Exactly one delete button — for the user's own substitution only.
    expect(screen.getAllByRole('button', { name: /delete substitution/i })).toHaveLength(1);
  });
});
