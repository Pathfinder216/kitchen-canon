import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';
import { AppLayout } from './AppLayout';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'user@example.com' }, logout: vi.fn() }),
}));

describe('AppLayout mobile navigation', () => {
  it('toggle button starts collapsed', () => {
    renderWithProviders(<AppLayout />);
    const toggle = screen.getByRole('button', { name: /toggle navigation menu/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Only the (CSS-hidden) desktop link is in the DOM before opening.
    expect(screen.getAllByRole('link', { name: 'Recipes' })).toHaveLength(1);
  });

  it('toggle reveals the nav links', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppLayout />);

    const toggle = screen.getByRole('button', { name: /toggle navigation menu/i });
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // Mobile menu adds a second copy of every destination + a Log out action.
    for (const label of ['Recipes', 'Meal Plans', 'Substitutions', 'Ingredients', 'Import']) {
      expect(screen.getAllByRole('link', { name: label })).toHaveLength(2);
    }
    expect(screen.getAllByRole('button', { name: 'Log out' })).toHaveLength(2);
  });

  it('closes the menu when a link is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppLayout />);

    const toggle = screen.getByRole('button', { name: /toggle navigation menu/i });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const mobileLinks = screen.getAllByRole('link', { name: 'Import' });
    await user.click(mobileLinks[mobileLinks.length - 1]);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('link', { name: 'Import' })).toHaveLength(1);
  });
});
