import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu, MenuItemButton } from './Menu';

function renderMenu(onPick = vi.fn()) {
  render(
    <Menu label="Open" buttonAriaLabel="Open menu">
      <MenuItemButton onClick={() => onPick('one')}>One</MenuItemButton>
      <MenuItemButton onClick={() => onPick('two')} selected>Two</MenuItemButton>
    </Menu>,
  );
  return onPick;
}

describe('Menu', () => {
  it('is closed until the button is clicked', async () => {
    const user = userEvent.setup();
    renderMenu();

    expect(screen.queryByText('One')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
  });

  it('fires the item handler and closes on selection', async () => {
    const user = userEvent.setup();
    const onPick = renderMenu();

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByText('One'));

    expect(onPick).toHaveBeenCalledWith('one');
    expect(screen.queryByText('One')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByText('One')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('One')).not.toBeInTheDocument();
  });

  it('activates the first item with ArrowDown (keyboard navigation)', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    // Headless UI tracks the active item virtually (data-active / aria-activedescendant)
    // rather than moving real DOM focus off the menu container.
    await user.keyboard('{ArrowDown}');
    const firstItem = screen.getByText('One');
    expect(firstItem).toHaveAttribute('data-active');
    expect(screen.getByRole('menu')).toHaveAttribute('aria-activedescendant', firstItem.id);
  });
});
