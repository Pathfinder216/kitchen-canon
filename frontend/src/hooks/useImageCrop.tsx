import { useState, type ReactNode } from 'react';
import { ImageCropDialog } from '../components/ui/ImageCropDialog';
import { shouldOfferCrop } from '../utils/cropImage';

/**
 * Routes a picked file through the optional crop dialog (plan 26) before handing it to `onFile`.
 * Images open the dialog; videos (and GIF/SVG) go straight through. `target` identifies what the
 * file is for (e.g. a step id) and is passed back unchanged — only one pick is pending at a time.
 *
 * Render the returned `dialog` somewhere in the component tree.
 */
export function useImageCrop<T = void>(onFile: (file: File, target: T) => void): {
  pick: (file: File, target: T) => void;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<{ file: File; target: T } | null>(null);

  function pick(file: File, target: T) {
    if (shouldOfferCrop(file)) setPending({ file, target });
    else onFile(file, target);
  }

  function finish(file: File | null) {
    const current = pending;
    setPending(null);
    if (current && file) onFile(file, current.target);
  }

  const dialog = pending ? (
    <ImageCropDialog
      file={pending.file}
      onConfirm={(cropped) => finish(cropped)}
      onSkip={() => finish(pending.file)}
      onCancel={() => finish(null)}
    />
  ) : null;

  return { pick, dialog };
}
