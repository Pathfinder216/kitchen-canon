import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CookModePage } from './CookModePage';

vi.mock('../api/recipes', () => ({
  fetchRecipe: vi.fn(),
}));

import { fetchRecipe } from '../api/recipes';
const mockFetchRecipe = fetchRecipe as ReturnType<typeof vi.fn>;

const mockRecipe = {
  id: 'r1',
  title: 'Test Recipe',
  servings: 4,
  totalTime: 30,
  activeTime: 15,
  archived: false,
  version: 1,
  parentId: null,
  isLatest: true,
  source: null,
  authorNotes: null,
  personalNotes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ingredients: [
    { id: 'i1', recipeId: 'r1', name: 'Flour', amount: 2, unit: 'cups', isOptional: false, orderIndex: 0, originalName: null },
  ],
  steps: [
    { id: 's1', recipeId: 'r1', orderIndex: 0, instruction: 'Mix the flour', timeMinutes: 5, isActiveTime: true },
    { id: 's2', recipeId: 'r1', orderIndex: 1, instruction: 'Let it rest', timeMinutes: 10, isActiveTime: false },
    { id: 's3', recipeId: 'r1', orderIndex: 2, instruction: 'Bake it', timeMinutes: null, isActiveTime: false },
  ],
};

function renderPage(id = 'r1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/recipes/${id}/cook`]}>
        <Routes>
          <Route path="/recipes/:id/cook" element={<CookModePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CookModePage', () => {
  beforeEach(() => {
    mockFetchRecipe.mockResolvedValue(mockRecipe);
  });

  it('shows loading state', () => {
    mockFetchRecipe.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders recipe title and step 1', async () => {
    renderPage();
    expect(await screen.findByText('Test Recipe')).toBeInTheDocument();
    expect(screen.getByText('Mix the flour')).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
  });

  it('does not show timer for active time steps', async () => {
    renderPage();
    await screen.findByText('Mix the flour');
    // Step 1 is active time — no timer should be shown
    expect(screen.queryByRole('button', { name: /start timer/i })).not.toBeInTheDocument();
  });

  it('shows timer for passive time steps', async () => {
    renderPage();
    await screen.findByText('Mix the flour');
    // Navigate to step 2 (passive time with 10 minutes)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Let it rest')).toBeInTheDocument();
    expect(screen.getByText(/10 min \(passive\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start timer/i })).toBeInTheDocument();
  });

  it('navigates to next step', async () => {
    renderPage();
    await screen.findByText('Mix the flour');
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Let it rest')).toBeInTheDocument();
    expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
  });

  it('shows Finish link on last step', async () => {
    renderPage();
    await screen.findByText('Mix the flour');
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('link', { name: /finish/i })).toBeInTheDocument();
  });

  it('previous button is disabled on first step', async () => {
    renderPage();
    await screen.findByText('Mix the flour');
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('shows ingredients checklist', async () => {
    renderPage();
    await screen.findByText('Mix the flour');
    const summary = screen.getByText(/ingredients \(1\)/i);
    fireEvent.click(summary);
    expect(screen.getByText('Flour')).toBeInTheDocument();
  });

  it('timer persists in panel when navigating away from step', async () => {
    renderPage();
    await screen.findByText('Mix the flour');

    // Navigate to step 2 (passive)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Let it rest')).toBeInTheDocument();

    // Start the timer
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));

    // Navigate away to step 3
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Bake it')).toBeInTheDocument();

    // Timer from step 2 should be visible in the running timers panel
    expect(screen.getByText(/Step 2: Let it rest/)).toBeInTheDocument();
  });

  it('can dismiss a timer from the running panel', async () => {
    renderPage();
    await screen.findByText('Mix the flour');

    // Navigate to step 2, start timer, go to step 3
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Timer panel visible
    expect(screen.getByText(/Step 2: Let it rest/)).toBeInTheDocument();

    // Dismiss it
    fireEvent.click(screen.getByRole('button', { name: /dismiss timer/i }));
    expect(screen.queryByText(/Step 2: Let it rest/)).not.toBeInTheDocument();
  });

  it('can pause and resume a timer from the running panel', async () => {
    renderPage();
    await screen.findByText('Mix the flour');

    // Navigate to step 2, start timer, go to step 3
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /start timer/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Pause from panel
    fireEvent.click(screen.getByRole('button', { name: /pause timer/i }));
    // Now resume button should appear
    expect(screen.getByRole('button', { name: /resume timer/i })).toBeInTheDocument();

    // Resume it
    fireEvent.click(screen.getByRole('button', { name: /resume timer/i }));
    expect(screen.getByRole('button', { name: /pause timer/i })).toBeInTheDocument();
  });
});
