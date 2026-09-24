import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';
import { StepMedia } from './StepMedia';
import { RecipeMedia } from './RecipeMedia';
import { fetchStepMedia, uploadStepMedia, fetchRecipeCover, uploadRecipeCover } from '../api/media';

// Live upload paths (editing an existing recipe) — plan 26 crop wiring.
vi.mock('../api/media', () => ({
  fetchStepMedia: vi.fn(),
  uploadStepMedia: vi.fn(),
  deleteStepMedia: vi.fn(),
  fetchRecipeCover: vi.fn(),
  uploadRecipeCover: vi.fn(),
  deleteRecipeMedia: vi.fn(),
}));

vi.mock('react-easy-crop', () => ({ default: () => <div data-testid="cropper" /> }));

const { createObjectURL, revokeObjectURL } = URL;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  vi.mocked(fetchStepMedia).mockResolvedValue(null);
  vi.mocked(fetchRecipeCover).mockResolvedValue(null);
  vi.mocked(uploadStepMedia).mockReset().mockResolvedValue({ id: 'm1', type: 'image', path: '/media/x.jpg' });
  vi.mocked(uploadRecipeCover).mockReset().mockResolvedValue({ id: 'm2', type: 'image', path: '/media/y.jpg' });
});
afterEach(() => {
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
});

describe('StepMedia upload', () => {
  it('uploads a video straight away without the crop dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StepMedia stepId="s1" />);
    const clip = new File(['vid'], 'clip.mp4', { type: 'video/mp4' });

    await user.upload(await screen.findByLabelText(/add photo \/ video/i), clip);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(uploadStepMedia).toHaveBeenCalledWith('s1', clip));
  });

  it('shows the crop dialog for an image and uploads the original on "Use full image"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StepMedia stepId="s1" />);
    const photo = new File(['img'], 'step.png', { type: 'image/png' });

    await user.upload(await screen.findByLabelText(/add photo \/ video/i), photo);
    expect(await screen.findByRole('dialog', { name: 'Crop image' })).toBeInTheDocument();
    expect(uploadStepMedia).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Use full image' }));
    await waitFor(() => expect(uploadStepMedia).toHaveBeenCalledWith('s1', photo));
  });
});

describe('RecipeMedia upload', () => {
  it('cancelling the crop dialog uploads nothing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecipeMedia recipeId="r1" />);

    await user.upload(
      await screen.findByLabelText(/add cover photo/i),
      new File(['img'], 'cover.jpg', { type: 'image/jpeg' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(uploadRecipeCover).not.toHaveBeenCalled();
  });
});
