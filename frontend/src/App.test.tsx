import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Route-aware fetch mock. `authed` controls whether /auth/me succeeds.
let authed = true;

beforeEach(() => {
  authed = true;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/api/auth/me')) {
      return authed ? jsonResponse({ id: 'u1', email: 'user@example.com' }) : jsonResponse({ error: 'Not authenticated' }, 401);
    }
    if (url.includes('/api/auth/csrf')) return jsonResponse({ csrfToken: 'test-token' });
    if (url.includes('/api/recipes')) {
      return jsonResponse({ recipes: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    }
    // List endpoints consumed by FilterPanel / forms expect arrays.
    if (url.includes('/api/labels') || url.includes('/api/ingredients') || url.includes('/api/courses')) {
      return jsonResponse([]);
    }
    return jsonResponse({});
  });
});

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App (authenticated)', () => {
  it('renders the app title', async () => {
    renderApp();
    expect(await screen.findByText('Kitchen Canon')).toBeInTheDocument();
  });

  it('renders the recipe list page by default', async () => {
    renderApp();
    expect(await screen.findByText('My Recipes')).toBeInTheDocument();
  });

  it('renders navigation', async () => {
    renderApp();
    expect(await screen.findByRole('link', { name: 'Recipes' })).toBeInTheDocument();
  });

  it('renders the new recipe page', async () => {
    renderApp('/recipes/new');
    expect(await screen.findByText('New Recipe')).toBeInTheDocument();
  });

  it('renders the new recipe button on the list page', async () => {
    renderApp();
    expect(await screen.findByRole('link', { name: '+ New Recipe' })).toBeInTheDocument();
  });
});

describe('App (unauthenticated)', () => {
  it('redirects to the login page', async () => {
    authed = false;
    renderApp('/');
    expect(await screen.findByText('Log in to your account')).toBeInTheDocument();
  });
});
