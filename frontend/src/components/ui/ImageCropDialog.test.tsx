import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { ImageCropDialog } from './ImageCropDialog';
import { cropImageFile } from '../../utils/cropImage';

// jsdom can't lay out or decode images, so stand in for the cropper: report a loaded 2000×1000
// image and a completed crop, and echo the aspect it was given.
vi.mock('react-easy-crop', () => ({
  default: function FakeCropper(props: {
    aspect: number;
    onCropComplete?: (a: unknown, px: { x: number; y: number; width: number; height: number }) => void;
    onMediaLoaded?: (s: { width: number; height: number; naturalWidth: number; naturalHeight: number }) => void;
  }) {
    const { onCropComplete, onMediaLoaded } = props;
    useEffect(() => {
      onMediaLoaded?.({ width: 400, height: 200, naturalWidth: 2000, naturalHeight: 1000 });
      onCropComplete?.({}, { x: 10, y: 20, width: 300, height: 200 });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return <div data-testid="cropper" data-aspect={props.aspect} />;
  },
}));

vi.mock('../../utils/cropImage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/cropImage')>()),
  cropImageFile: vi.fn(),
}));

const { createObjectURL, revokeObjectURL } = URL;

describe('ImageCropDialog', () => {
  const file = new File(['img'], 'cake.png', { type: 'image/png' });

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:cake');
    URL.revokeObjectURL = vi.fn();
    vi.mocked(cropImageFile).mockReset();
  });
  afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  function renderDialog() {
    const handlers = { onConfirm: vi.fn(), onSkip: vi.fn(), onCancel: vi.fn() };
    render(<ImageCropDialog file={file} {...handlers} />);
    return handlers;
  }

  it('defaults to the original aspect ratio so the crop covers the whole image', async () => {
    renderDialog();
    expect(await screen.findByRole('dialog', { name: 'Crop image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Original' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.getByTestId('cropper')).toHaveAttribute('data-aspect', '2'));
  });

  it('switches to a quick ratio', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(await screen.findByRole('button', { name: '1:1' }));
    expect(screen.getByRole('button', { name: '1:1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('cropper')).toHaveAttribute('data-aspect', '1');
  });

  it('crops the selected area and confirms with the cropped file', async () => {
    const user = userEvent.setup();
    const cropped = new File(['jpeg'], 'cake.jpg', { type: 'image/jpeg' });
    vi.mocked(cropImageFile).mockResolvedValue(cropped);
    const { onConfirm, onSkip } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Crop' }));

    expect(cropImageFile).toHaveBeenCalledWith(file, { x: 10, y: 20, width: 300, height: 200 });
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(cropped));
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('shows an error and stays open when cropping fails', async () => {
    const user = userEvent.setup();
    vi.mocked(cropImageFile).mockRejectedValue(new Error('Could not read the image'));
    const { onConfirm } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Crop' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not read the image');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Use full image' })).toBeEnabled();
  });

  it('"Use full image" skips and Cancel cancels without cropping', async () => {
    const user = userEvent.setup();
    const { onSkip, onCancel } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Use full image' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(cropImageFile).not.toHaveBeenCalled();
  });
});
