import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { renderWithProviders } from '../test/utils';
import { RecipeForm } from './RecipeForm';
import { cropImageFile } from '../utils/cropImage';

// Crop-at-pick-time for pending (create mode) media — plan 26. jsdom can't run the real cropper
// or canvas, so both are stubbed; the geometry has its own tests in utils/cropImage.test.ts.
vi.mock('react-easy-crop', () => ({
  default: function FakeCropper({ onCropComplete }: {
    onCropComplete?: (a: unknown, px: { x: number; y: number; width: number; height: number }) => void;
  }) {
    useEffect(() => {
      onCropComplete?.({}, { x: 0, y: 0, width: 100, height: 100 });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return <div data-testid="cropper" />;
  },
}));

vi.mock('../utils/cropImage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/cropImage')>()),
  cropImageFile: vi.fn(),
}));

const { createObjectURL, revokeObjectURL } = URL;

describe('RecipeForm media crop', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    vi.mocked(cropImageFile).mockReset();
  });
  afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  async function fillTitle(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/title/i), 'Cake');
  }

  it('picking a cover image opens the crop dialog; "Use full image" keeps the original file', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<RecipeForm onSubmit={onSubmit} isSubmitting={false} />);
    await fillTitle(user);

    const photo = new File(['img'], 'cake.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/add cover photo/i), photo);

    expect(await screen.findByRole('dialog', { name: 'Crop image' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use full image' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByText('Create Recipe'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ coverPhoto: photo }),
      [],
      [],
    );
    expect(cropImageFile).not.toHaveBeenCalled();
  });

  it('a confirmed crop replaces the picked file in pending state', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const cropped = new File(['jpeg'], 'cake.jpg', { type: 'image/jpeg' });
    vi.mocked(cropImageFile).mockResolvedValue(cropped);
    renderWithProviders(<RecipeForm onSubmit={onSubmit} isSubmitting={false} />);
    await fillTitle(user);

    await user.upload(screen.getByLabelText(/add cover photo/i), new File(['img'], 'cake.png', { type: 'image/png' }));
    await user.click(await screen.findByRole('button', { name: 'Crop' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByText('Create Recipe'));
    expect(onSubmit.mock.calls[0][1].coverPhoto).toBe(cropped);
  });

  it('cancelling the crop leaves no pending cover photo', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<RecipeForm onSubmit={onSubmit} isSubmitting={false} />);
    await fillTitle(user);

    await user.upload(screen.getByLabelText(/add cover photo/i), new File(['img'], 'cake.png', { type: 'image/png' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Still the empty "add" state, not a preview.
    expect(screen.getByLabelText(/add cover photo/i)).toBeInTheDocument();
    await user.click(screen.getByText('Create Recipe'));
    expect(onSubmit.mock.calls[0][1].coverPhoto).toBeUndefined();
  });

  it('a step image goes through the dialog; a step video bypasses it', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<RecipeForm onSubmit={onSubmit} isSubmitting={false} />);
    await fillTitle(user);
    await user.click(screen.getByText('+ Add Step'));
    await user.type(screen.getByPlaceholderText('Step instruction'), 'Whisk');
    await user.click(screen.getByText('+ Add Step'));
    await user.type(screen.getAllByPlaceholderText('Step instruction')[1], 'Bake');

    const [firstStepInput] = screen.getAllByLabelText(/add photo \/ video/i);
    const clip = new File(['vid'], 'whisk.mp4', { type: 'video/mp4' });
    await user.upload(firstStepInput, clip);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const secondStepInput = screen.getByLabelText(/add photo \/ video/i);
    const photo = new File(['img'], 'bake.jpg', { type: 'image/jpeg' });
    await user.upload(secondStepInput, photo);
    await user.click(await screen.findByRole('button', { name: 'Use full image' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByText('Create Recipe'));
    expect(onSubmit.mock.calls[0][1].stepMedia).toEqual([
      { orderIndex: 0, file: clip },
      { orderIndex: 1, file: photo },
    ]);
  });
});
