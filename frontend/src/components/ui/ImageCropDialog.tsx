import { useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Modal } from './Modal';
import { cropImageFile } from '../../utils/cropImage';

interface ImageCropDialogProps {
  /** The picked image. The dialog is open while this component is mounted. */
  file: File;
  /** Called with the cropped JPEG. */
  onConfirm: (file: File) => void;
  /** "Use full image" — upload the original file untouched. */
  onSkip: () => void;
  /** Abandon the pick entirely; nothing is uploaded. */
  onCancel: () => void;
}

// `null` = the photo's own aspect ratio, so the crop starts out covering the whole image.
// react-easy-crop always crops at a fixed ratio (there are no free-form drag handles), so
// "Original" stands in for the plan's "free" option.
const RATIOS: Array<{ label: string; value: number | null }> = [
  { label: 'Original', value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
];

const secondaryButton =
  'border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50';

/**
 * Optional crop step shown when an image is picked for upload (plan 26). Pan by dragging, zoom
 * with the slider / wheel / pinch, pick an aspect ratio, then "Crop" — or "Use full image" to
 * upload the original as-is.
 */
export function ImageCropDialog({ file, onConfirm, onSkip, onCancel }: ImageCropDialogProps) {
  // Preview URL for the cropper. Every way out of the dialog goes through `close`, which revokes
  // it; the file can't change while the dialog is open (the host remounts it per pick).
  const [src] = useState(() => URL.createObjectURL(file));
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const aspect = ratio ?? naturalAspect ?? 4 / 3;

  function close(exit: () => void) {
    URL.revokeObjectURL(src);
    exit();
  }

  function selectRatio(value: number | null) {
    setRatio(value);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  async function handleConfirm() {
    if (!areaPixels) {
      close(onSkip);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const cropped = await cropImageFile(file, areaPixels);
      close(() => onConfirm(cropped));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not crop the image');
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => { if (!busy) close(onCancel); }}
      title="Crop image"
      panelClassName="relative bg-white rounded-xl shadow-xl p-5 w-full max-w-xl"
      footer={
        <>
          <button type="button" onClick={() => close(onCancel)} disabled={busy} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={() => close(onSkip)} disabled={busy} className={secondaryButton}>
            Use full image
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !areaPixels}
            className="bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            {busy ? 'Cropping…' : 'Crop'}
          </button>
        </>
      }
    >
      <div className="relative h-72 sm:h-80 w-full bg-gray-900 rounded-lg overflow-hidden">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_area, pixels) => setAreaPixels(pixels)}
          onMediaLoaded={({ naturalWidth, naturalHeight }) => {
            if (naturalWidth > 0 && naturalHeight > 0) setNaturalAspect(naturalWidth / naturalHeight);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Aspect ratio">
          {RATIOS.map(({ label, value }) => (
            <button
              key={label}
              type="button"
              aria-pressed={ratio === value}
              onClick={() => selectRatio(value)}
              className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                ratio === value
                  ? 'bg-orange-600 border-orange-600 text-white'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-500 ml-auto">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-28 accent-orange-600"
          />
        </label>
      </div>

      <p className="text-xs text-red-600 mt-2 mb-3 min-h-4" role={error ? 'alert' : undefined}>{error}</p>
    </Modal>
  );
}
