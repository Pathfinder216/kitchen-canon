import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecipeCard } from './RecipeCard';
import type { Recipe } from '../types/recipe';

const mockRecipe: Recipe = {
  id: '1',
  title: 'Scrambled Eggs',
  servings: 2,
  totalTime: 10,
  activeTime: 10,
  source: 'https://example.com',
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
  parentId: null,
  isLatest: true,
  authorNotes: null,
  personalNotes: null,
  ingredients: [
    { id: '1', recipeId: '1', name: 'eggs', originalName: null, amount: 4, unit: 'large', isOptional: false, orderIndex: 0, internalId: 'eggs_1' },
    { id: '2', recipeId: '1', name: 'butter', originalName: null, amount: 1, unit: 'tbsp', isOptional: false, orderIndex: 1, internalId: 'butter_1' },
  ],
  steps: [],
};

function renderCard(recipe = mockRecipe) {
  return render(
    <MemoryRouter>
      <RecipeCard recipe={recipe} />
    </MemoryRouter>,
  );
}

describe('RecipeCard', () => {
  it('renders recipe title', () => {
    renderCard();
    expect(screen.getByText('Scrambled Eggs')).toBeInTheDocument();
  });

  it('renders total time', () => {
    renderCard();
    expect(screen.getByText('10 min')).toBeInTheDocument();
  });

  it('renders servings', () => {
    renderCard();
    expect(screen.getByText('2 servings')).toBeInTheDocument();
  });

  it('renders ingredient count', () => {
    renderCard();
    expect(screen.getByText('2 ingredients')).toBeInTheDocument();
  });

  it('renders source', () => {
    renderCard();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  it('links to recipe detail page', () => {
    renderCard();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/recipes/1');
  });

  it('handles singular serving text', () => {
    renderCard({ ...mockRecipe, servings: 1 });
    expect(screen.getByText('1 serving')).toBeInTheDocument();
  });

  it('hides time when not set', () => {
    renderCard({ ...mockRecipe, totalTime: null });
    expect(screen.queryByText(/min/)).not.toBeInTheDocument();
  });
});
