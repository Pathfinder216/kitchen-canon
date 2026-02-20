import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// Mock fetch to prevent actual API calls
beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ recipes: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
});

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  it('renders the app title', () => {
    renderApp();
    expect(screen.getByText('Let Them Cook')).toBeInTheDocument();
  });

  it('renders the recipe list page by default', () => {
    renderApp();
    expect(screen.getByText('My Recipes')).toBeInTheDocument();
  });

  it('renders navigation', () => {
    renderApp();
    expect(screen.getByRole('link', { name: 'Recipes' })).toBeInTheDocument();
  });

  it('renders the new recipe page', () => {
    renderApp('/recipes/new');
    expect(screen.getByText('New Recipe')).toBeInTheDocument();
  });

  it('renders the new recipe button on the list page', () => {
    renderApp();
    expect(screen.getByRole('link', { name: '+ New Recipe' })).toBeInTheDocument();
  });
});
