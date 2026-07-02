import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';
import { IngredientsPage } from './IngredientsPage';
import type { CatalogEntry } from '../api/ingredients';

vi.mock('../api/ingredients', async () => {
  const actual = await vi.importActual<typeof import('../api/ingredients')>('../api/ingredients');
  return {
    ...actual,
    fetchIngredients: vi.fn(),
    createIngredientEntry: vi.fn(),
    updateIngredientEntry: vi.fn(),
    deleteIngredientEntry: vi.fn(),
  };
});

vi.mock('../hooks/useDietaryTags', () => ({
  useDietaryTags: () => ({
    allergens: ['dairy', 'gluten'],
    diets: ['vegan', 'vegetarian'],
    allergenLabels: { dairy: 'Dairy', gluten: 'Gluten' },
    dietLabels: { vegan: 'Vegan', vegetarian: 'Vegetarian' },
  }),
}));

import {
  fetchIngredients,
  createIngredientEntry,
  updateIngredientEntry,
  deleteIngredientEntry,
} from '../api/ingredients';

const mockFetch = fetchIngredients as ReturnType<typeof vi.fn>;
const mockCreate = createIngredientEntry as ReturnType<typeof vi.fn>;
const mockUpdate = updateIngredientEntry as ReturnType<typeof vi.fn>;
const mockDelete = deleteIngredientEntry as ReturnType<typeof vi.fn>;

function entry(overrides: Partial<CatalogEntry>): CatalogEntry {
  return {
    id: 'id-1',
    displayAlias: 'butter',
    allergens: [],
    diets: [],
    isUserAdded: false,
    userId: null,
    aliases: [],
    ...overrides,
  };
}

const globalButter = entry({
  id: 'g1',
  displayAlias: 'butter',
  allergens: ['dairy'],
  diets: ['vegetarian'],
  userId: null,
});

const userChutney = entry({
  id: 'u1',
  displayAlias: 'chutney',
  diets: ['vegan'],
  isUserAdded: true,
  userId: 'user-1',
});

const userButter = entry({
  id: 'u2',
  displayAlias: 'butter',
  allergens: ['dairy'],
  diets: [],
  isUserAdded: true,
  userId: 'user-1',
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('IngredientsPage', () => {
  it('renders global entries read-only with a built-in badge and a Customize action', async () => {
    mockFetch.mockResolvedValue([globalButter]);
    renderWithProviders(<IngredientsPage />);

    expect(await screen.findByText('butter')).toBeInTheDocument();
    expect(screen.getByText('built-in')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /customize/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit ingredient/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete ingredient/i })).not.toBeInTheDocument();
  });

  it('renders user entries with edit and delete but no badge', async () => {
    mockFetch.mockResolvedValue([userChutney]);
    renderWithProviders(<IngredientsPage />);

    expect(await screen.findByText('chutney')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit ingredient/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete ingredient/i })).toBeInTheDocument();
    expect(screen.queryByText('built-in')).not.toBeInTheDocument();
    expect(screen.queryByText('customized')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /customize/i })).not.toBeInTheDocument();
  });

  it('customizing a global posts a user-private shadow entry pre-filled from the global', async () => {
    mockFetch.mockResolvedValue([globalButter]);
    mockCreate.mockResolvedValue(userButter);
    const user = userEvent.setup();
    renderWithProviders(<IngredientsPage />);

    await user.click(await screen.findByRole('button', { name: /customize/i }));

    // Editor is pre-filled from the global's tags: toggle vegetarian off.
    await user.click(screen.getByRole('button', { name: 'Vegetarian' }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockCreate).toHaveBeenCalledWith({
      name: 'butter',
      allergens: ['dairy'],
      diets: [],
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('dedupes a shadowed global: shows once as the user version with a customized badge and reset', async () => {
    mockFetch.mockResolvedValue([globalButter, userButter, userChutney]);
    renderWithProviders(<IngredientsPage />);

    expect(await screen.findByText('chutney')).toBeInTheDocument();
    // Only one butter row, the user's.
    expect(screen.getAllByText('butter')).toHaveLength(1);
    expect(screen.getByText('customized')).toBeInTheDocument();
    expect(screen.queryByText('built-in')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /customize/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset to default/i })).toBeInTheDocument();
    // The customized row is still editable but its delete affordance is the reset button;
    // the plain user entry (chutney) keeps a trash delete.
    expect(screen.getAllByRole('button', { name: /edit ingredient/i })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /delete ingredient/i })).toHaveLength(1);
    // Header count reflects the deduped list.
    expect(screen.getByText(/2 ingredients/)).toBeInTheDocument();
  });

  it('reset to default deletes the private shadow entry', async () => {
    mockFetch.mockResolvedValue([globalButter, userButter]);
    mockDelete.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<IngredientsPage />);

    await user.click(await screen.findByRole('button', { name: /reset to default/i }));
    expect(mockDelete).toHaveBeenCalledWith('u2');
  });

  it('editing a user entry patches it in place (no shadow post)', async () => {
    mockFetch.mockResolvedValue([userChutney]);
    mockUpdate.mockResolvedValue(userChutney);
    const user = userEvent.setup();
    renderWithProviders(<IngredientsPage />);

    await user.click(await screen.findByRole('button', { name: /edit ingredient/i }));
    await user.click(screen.getByRole('button', { name: 'Gluten' }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockUpdate).toHaveBeenCalledWith('u1', {
      allergens: ['gluten'],
      diets: ['vegan'],
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
