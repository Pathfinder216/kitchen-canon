import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RecipeForm } from './RecipeForm';

function renderForm(props: Partial<Parameters<typeof RecipeForm>[0]> = {}) {
  return render(
    <MemoryRouter>
      <RecipeForm onSubmit={vi.fn()} isSubmitting={false} {...props} />
    </MemoryRouter>,
  );
}

describe('RecipeForm', () => {
  it('renders empty form for new recipe', () => {
    renderForm();

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/servings/i)).toBeInTheDocument();
    expect(screen.getByText('Create Recipe')).toBeInTheDocument();
  });

  it('shows "Save Changes" when editing', () => {
    const recipe = {
      id: '1', title: 'Test', servings: 1, totalTime: null, activeTime: null,
      source: null, archived: false, createdAt: '', updatedAt: '',
      version: 1, parentId: null, isLatest: true, authorNotes: null,
      personalNotes: null, ingredients: [], steps: [],
    };
    renderForm({ initialData: recipe });

    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('submits form data', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    await user.clear(screen.getByLabelText(/title/i));
    await user.type(screen.getByLabelText(/title/i), 'My New Recipe');
    await user.click(screen.getByText('Create Recipe'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'My New Recipe', servings: 1 }),
      expect.objectContaining({ stepMedia: [] }),
    );
  });

  it('adds and removes ingredients', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByText('+ Add Ingredient'));
    expect(screen.getByPlaceholderText('Ingredient name')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove ingredient/i }));
    expect(screen.queryByPlaceholderText('Ingredient name')).not.toBeInTheDocument();
  });

  it('adds and removes steps', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByText('+ Add Step'));
    expect(screen.getByPlaceholderText('Step instruction')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove step/i }));
    expect(screen.queryByPlaceholderText('Step instruction')).not.toBeInTheDocument();
  });

  it('disables submit when title is empty', () => {
    renderForm();
    expect(screen.getByText('Create Recipe')).toBeDisabled();
  });

  it('disables submit when submitting', async () => {
    const user = userEvent.setup();
    renderForm({ isSubmitting: true });

    await user.type(screen.getByLabelText(/title/i), 'Test');
    expect(screen.getByText('Saving...')).toBeDisabled();
  });

  it('pre-populates from importData', () => {
    const importData = {
      title: 'Imported Recipe',
      servings: 4,
      totalTime: 30,
      activeTime: 15,
      source: 'https://example.com',
      authorNotes: 'Some notes',
      ingredients: [
        { name: 'Flour', originalName: 'Flour', amount: 2, unit: 'cups', isOptional: false, orderIndex: 0 },
      ],
      steps: [
        { orderIndex: 0, instruction: 'Mix everything', timeMinutes: null, isActiveTime: true },
      ],
    };
    renderForm({ importData });

    expect(screen.getByLabelText(/title/i)).toHaveValue('Imported Recipe');
    expect(screen.getByPlaceholderText('Ingredient name')).toHaveValue('Flour');
  });

  it('shows drag handles for ingredients', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByText('+ Add Ingredient'));
    expect(screen.getByRole('generic', { name: /drag to reorder/i })).toBeInTheDocument();
  });

  it('shows import link for new recipe', () => {
    renderForm();
    expect(screen.getByRole('link', { name: /import from url/i })).toBeInTheDocument();
  });

  it('does not show import link when editing', () => {
    const recipe = {
      id: '1', title: 'Test', servings: 1, totalTime: null, activeTime: null,
      source: null, archived: false, createdAt: '', updatedAt: '',
      version: 1, parentId: null, isLatest: true, authorNotes: null,
      personalNotes: null, ingredients: [], steps: [],
    };
    renderForm({ initialData: recipe });
    expect(screen.queryByRole('link', { name: /import from url/i })).not.toBeInTheDocument();
  });
});
