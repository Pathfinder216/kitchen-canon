import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';
import { GroceryList } from './GroceryList';
import type { GroceryItem } from '../types/meal-plan';

vi.mock('../hooks/useAisles', async () => {
  const actual = await vi.importActual<typeof import('../hooks/useAisles')>('../hooks/useAisles');
  return {
    ...actual,
    useAisles: () => ({
      aisles: ['produce', 'dairy-eggs', 'deli', 'baking-spices', 'household-other'],
      aisleLabels: {
        produce: 'Produce',
        'dairy-eggs': 'Dairy & Eggs',
        deli: 'Deli',
        'baking-spices': 'Baking & Spices',
        'household-other': 'Other',
      },
    }),
  };
});

vi.mock('../api/ingredients', async () => {
  const actual = await vi.importActual<typeof import('../api/ingredients')>('../api/ingredients');
  return { ...actual, setIngredientAisle: vi.fn() };
});

// Default to the "original" preference so the existing assertions see authored units.
vi.mock('../api/preferences', async () => {
  const actual = await vi.importActual<typeof import('../api/preferences')>('../api/preferences');
  return {
    ...actual,
    fetchPreferences: vi.fn(async () => ({ unitSystem: 'original', locale: 'en-US', theme: 'light' })),
  };
});

import { setIngredientAisle } from '../api/ingredients';
import { fetchPreferences } from '../api/preferences';
const mockSetAisle = setIngredientAisle as ReturnType<typeof vi.fn>;
const mockFetchPreferences = fetchPreferences as ReturnType<typeof vi.fn>;

const render = renderWithProviders;

const makeItem = (override: Partial<GroceryItem> = {}): GroceryItem => ({
  id: 'item-1',
  mealPlanId: 'plan-1',
  ingredient: 'Flour',
  amount: 2,
  unit: 'cups',
  purchased: false,
  ...override,
});

describe('GroceryList', () => {
  it('shows empty message when no items', () => {
    render(<GroceryList items={[]} />);
    expect(screen.getByText(/no grocery items/i)).toBeInTheDocument();
  });

  it('renders ingredient name and amount', () => {
    render(<GroceryList items={[makeItem()]} />);
    expect(screen.getByText('Flour')).toBeInTheDocument();
    expect(screen.getByText(/2 cups/)).toBeInTheDocument();
  });

  it('does not show the alias parenthetical', () => {
    render(<GroceryList items={[makeItem({ ingredient: 'cilantro', amount: null, unit: null })]} />);
    expect(screen.getByText('cilantro')).toBeInTheDocument();
    expect(screen.queryByText(/\(coriander\)/)).not.toBeInTheDocument();
  });

  it('renders item without amount', () => {
    render(<GroceryList items={[makeItem({ amount: null, unit: null })]} />);
    expect(screen.getByText('Flour')).toBeInTheDocument();
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });

  it('calls onToggle when checkbox is clicked', () => {
    const onToggle = vi.fn();
    render(<GroceryList items={[makeItem()]} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('item-1', true);
  });

  it('renders purchased items in a separate section', () => {
    const items: GroceryItem[] = [
      makeItem({ id: 'a', ingredient: 'Flour', purchased: false }),
      makeItem({ id: 'b', ingredient: 'Sugar', purchased: true }),
    ];
    render(<GroceryList items={items} />);
    expect(screen.getByText(/purchased \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('Sugar')).toBeInTheDocument();
  });

  it('shows purchased item with line-through class', () => {
    render(<GroceryList items={[makeItem({ purchased: true })]} />);
    const label = screen.getByText('Flour');
    expect(label.className).toContain('line-through');
  });

  it('renders multiple items', () => {
    const items: GroceryItem[] = [
      makeItem({ id: 'a', ingredient: 'Flour' }),
      makeItem({ id: 'b', ingredient: 'Eggs', amount: 6, unit: null }),
    ];
    render(<GroceryList items={items} />);
    expect(screen.getByText('Flour')).toBeInTheDocument();
    expect(screen.getByText('Eggs')).toBeInTheDocument();
  });

  it('groups items under aisle headers in vocabulary order', () => {
    const items: GroceryItem[] = [
      makeItem({ id: 'a', ingredient: 'flour', aisle: 'baking-spices' }),
      makeItem({ id: 'b', ingredient: 'milk', aisle: 'dairy-eggs' }),
      makeItem({ id: 'c', ingredient: 'onion', aisle: 'produce' }),
    ];
    render(<GroceryList items={items} />);
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings).toEqual(['Produce', 'Dairy & Eggs', 'Baking & Spices']);
    expect(within(screen.getByRole('region', { name: 'Produce' })).getByText('onion')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Dairy & Eggs' })).getByText('milk')).toBeInTheDocument();
  });

  it('puts unresolved items (no or unknown aisle) under Other, last', () => {
    const items: GroceryItem[] = [
      makeItem({ id: 'a', ingredient: 'unobtainium', aisle: undefined }),
      makeItem({ id: 'b', ingredient: 'mystery', aisle: 'not-an-aisle' }),
      makeItem({ id: 'c', ingredient: 'onion', aisle: 'produce' }),
      makeItem({ id: 'd', ingredient: 'napkins', aisle: 'household-other' }),
    ];
    render(<GroceryList items={items} />);
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings).toEqual(['Produce', 'Other']);
    const other = within(screen.getByRole('region', { name: 'Other' }));
    expect(other.getByText('unobtainium')).toBeInTheDocument();
    expect(other.getByText('mystery')).toBeInTheDocument();
    expect(other.getByText('napkins')).toBeInTheDocument();
  });

  it('copies remaining items with aisle section headers', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const items: GroceryItem[] = [
      makeItem({ id: 'a', ingredient: 'flour', amount: 2, unit: 'cup', aisle: 'baking-spices' }),
      makeItem({ id: 'b', ingredient: 'onion', amount: 1, unit: null, aisle: 'produce' }),
      makeItem({ id: 'c', ingredient: 'salt', amount: null, unit: null, aisle: undefined }),
      makeItem({ id: 'd', ingredient: 'milk', aisle: 'dairy-eggs', purchased: true }),
    ];
    render(<GroceryList items={items} />);
    fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));
    expect(writeText).toHaveBeenCalledWith(
      ['Produce:', 'onion — 1', '', 'Baking & Spices:', 'flour — 2 cup', '', 'Other:', 'salt'].join('\n'),
    );
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });

  it("changes an item's aisle from its menu via the customize flow", async () => {
    mockSetAisle.mockResolvedValue({});
    const user = userEvent.setup();
    render(<GroceryList items={[makeItem({ id: 'a', ingredient: 'cheddar cheese', aisle: 'dairy-eggs' })]} />);

    await user.click(screen.getByRole('button', { name: /options for cheddar cheese/i }));
    await user.click(await screen.findByRole('menuitem', { name: /change aisle/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Dairy & Eggs' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(dialog).getByRole('button', { name: 'Deli' }));

    expect(mockSetAisle).toHaveBeenCalledWith('cheddar cheese', 'deli');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('GroceryList unit conversion (plan 27)', () => {
  it('converts amounts at render for a metric user', async () => {
    mockFetchPreferences.mockResolvedValue({ unitSystem: 'metric', locale: 'en-US', theme: 'light' });
    render(<GroceryList items={[makeItem({ amount: 2, unit: 'cup' })]} />);
    expect(await screen.findByText(/475 ml/)).toBeInTheDocument();
    expect(screen.queryByText(/2 cup/)).not.toBeInTheDocument();
  });

  it('shows the stored units for the original preference', async () => {
    mockFetchPreferences.mockResolvedValue({ unitSystem: 'original', locale: 'en-US', theme: 'light' });
    render(<GroceryList items={[makeItem({ amount: 2, unit: 'cup' })]} />);
    await waitFor(() => expect(mockFetchPreferences).toHaveBeenCalled());
    expect(screen.getByText(/2 cup/)).toBeInTheDocument();
  });
});
