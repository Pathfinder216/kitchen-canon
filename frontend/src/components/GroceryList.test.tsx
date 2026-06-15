import { render, screen, fireEvent } from '@testing-library/react';
import { GroceryList } from './GroceryList';
import type { GroceryItem } from '../types/meal-plan';

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
});
