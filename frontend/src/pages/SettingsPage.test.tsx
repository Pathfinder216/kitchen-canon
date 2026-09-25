import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';
import { SettingsPage } from './SettingsPage';

vi.mock('../api/preferences', async () => {
  const actual = await vi.importActual<typeof import('../api/preferences')>('../api/preferences');
  return { ...actual, fetchPreferences: vi.fn(), updatePreferences: vi.fn() };
});

import { fetchPreferences, updatePreferences } from '../api/preferences';
const mockFetch = fetchPreferences as ReturnType<typeof vi.fn>;
const mockUpdate = updatePreferences as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch.mockReset();
  mockUpdate.mockReset();
});

describe('SettingsPage', () => {
  it('shows the saved unit system as selected', async () => {
    mockFetch.mockResolvedValue({ unitSystem: 'metric', locale: 'en-US', theme: 'light' });
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByRole('radio', { name: /metric/i })).toBeChecked());
    await waitFor(() => expect(screen.getByRole('radio', { name: /metric/i })).toBeEnabled());
    expect(screen.getByRole('radio', { name: /as written/i })).not.toBeChecked();
  });

  it('PATCHes the preference when a different system is chosen', async () => {
    mockFetch.mockResolvedValue({ unitSystem: 'original', locale: 'en-US', theme: 'light' });
    mockUpdate.mockResolvedValue({ unitSystem: 'imperial', locale: 'en-US', theme: 'light' });
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);

    const imperial = await screen.findByRole('radio', { name: /imperial/i });
    await waitFor(() => expect(imperial).toBeEnabled());
    await user.click(imperial);

    expect(mockUpdate).toHaveBeenCalledWith({ unitSystem: 'imperial' });
    await waitFor(() => expect(screen.getByRole('radio', { name: /imperial/i })).toBeChecked());
  });

  it('reverts the selection and shows an error when saving fails', async () => {
    mockFetch.mockResolvedValue({ unitSystem: 'original', locale: 'en-US', theme: 'light' });
    mockUpdate.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);

    const metric = await screen.findByRole('radio', { name: /metric/i });
    await waitFor(() => expect(metric).toBeEnabled());
    await user.click(metric);

    expect(await screen.findByText(/failed to save/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /as written/i })).toBeChecked();
  });
});
