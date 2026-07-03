import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { ExportActions } from './RecipeActionsBar';
import type { Recipe, Ingredient } from '../../types/recipe';

const ingredients: Ingredient[] = [
  { id: 'i1', recipeId: 'r1', name: 'flour', originalName: null, amount: 2, unit: 'cups', isOptional: false, orderIndex: 0 },
];

const recipe: Recipe = {
  id: 'r1',
  title: 'Pancakes',
  servings: 4,
  totalTime: 30,
  activeTime: 15,
  source: null,
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
  parentId: null,
  isLatest: true,
  authorNotes: null,
  personalNotes: null,
  ingredients,
  steps: [],
  courses: [],
  labels: [],
};

function renderBar() {
  return render(
    <ExportActions
      recipe={recipe}
      finalIngredients={ingredients}
      swapDisplayNames={new Map()}
      targetServings={4}
    />,
  );
}

afterEach(() => {
  // Remove any share stub we installed.
  delete (navigator as unknown as { share?: unknown }).share;
  vi.restoreAllMocks();
});

describe('ExportActions share wiring', () => {
  it('hides the Share button when the Web Share API is unavailable', () => {
    renderBar();
    expect(screen.queryByRole('button', { name: 'Share…' })).not.toBeInTheDocument();
    // Email + Save as PDF are always available.
    expect(screen.getByRole('button', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save as PDF' })).toBeInTheDocument();
  });

  it('shows Share and calls navigator.share with the recipe title + text', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });

    renderBar();
    const btn = screen.getByRole('button', { name: 'Share…' });
    fireEvent.click(btn);

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const payload = share.mock.calls[0][0];
    expect(payload.title).toBe('Pancakes');
    expect(payload.text).toContain('Pancakes');
    expect(payload.text).toContain('- 2 cups flour');
  });

  it('swallows an AbortError when the user cancels the share sheet', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    const share = vi.fn().mockRejectedValue(abort);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
    const unhandled = vi.fn();
    window.addEventListener('unhandledrejection', unhandled);

    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Share…' }));

    await waitFor(() => expect(share).toHaveBeenCalled());
    // Give the rejected promise a tick to (not) surface.
    await Promise.resolve();
    expect(unhandled).not.toHaveBeenCalled();
    window.removeEventListener('unhandledrejection', unhandled);
  });
});
