vi.mock('./client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

import { apiGet, apiPost } from './client';
import { setIngredientAisle, type CatalogEntry } from './ingredients';

const mockGet = apiGet as ReturnType<typeof vi.fn>;
const mockPost = apiPost as ReturnType<typeof vi.fn>;

function entry(overrides: Partial<CatalogEntry>): CatalogEntry {
  return {
    id: 'id',
    displayAlias: 'cheddar cheese',
    allergens: [],
    diets: [],
    aisle: null,
    isUserAdded: false,
    userId: null,
    aliases: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPost.mockResolvedValue({});
});

describe('setIngredientAisle', () => {
  it("preserves the built-in entry's dietary tags when shadowing it", async () => {
    mockGet.mockResolvedValue([
      entry({ id: 'g', allergens: ['dairy'], diets: ['vegetarian'], aisle: 'dairy-eggs', aliases: [{ id: 'a', alias: 'cheddar cheese' }] }),
      entry({ id: 'x', displayAlias: 'cheddar cheese sauce', allergens: ['gluten'] }),
    ]);
    await setIngredientAisle('Cheddar Cheese', 'deli');
    expect(mockGet).toHaveBeenCalledWith('/ingredients', { q: 'cheddar cheese' });
    expect(mockPost).toHaveBeenCalledWith('/ingredients', {
      name: 'cheddar cheese',
      allergens: ['dairy'],
      diets: ['vegetarian'],
      aisle: 'deli',
    });
  });

  it("prefers the user's own entry over the built-in", async () => {
    mockGet.mockResolvedValue([
      entry({ id: 'g', allergens: ['dairy'], diets: ['vegetarian'] }),
      entry({ id: 'u', allergens: ['dairy'], diets: [], userId: 'user-1', isUserAdded: true }),
    ]);
    await setIngredientAisle('cheddar cheese', 'deli');
    expect(mockPost).toHaveBeenCalledWith('/ingredients', expect.objectContaining({ diets: [], aisle: 'deli' }));
  });

  it('posts empty tags for an ingredient not in the catalog', async () => {
    mockGet.mockResolvedValue([]);
    await setIngredientAisle('unobtainium', 'frozen');
    expect(mockPost).toHaveBeenCalledWith('/ingredients', { name: 'unobtainium', allergens: [], diets: [], aisle: 'frozen' });
  });
});
