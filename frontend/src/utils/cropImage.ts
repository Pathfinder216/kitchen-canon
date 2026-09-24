// Client-side image cropping for media uploads (plan 26). The crop is baked into a new JPEG in the
// browser and uploaded as an ordinary file — the server does no image processing.

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropGeometry {
  /** Region of the source image to copy, in natural-pixel coordinates. */
  source: CropRect;
  /** Size of the output canvas. */
  output: { width: number; height: number };
}

/** Longest output edge. Keeps canvases inside mobile browser limits and uploads well under 20 MB. */
export const MAX_OUTPUT_DIMENSION = 4096;
export const JPEG_QUALITY = 0.9;

/**
 * Pure geometry for a crop: rounds the crop rect (as reported by react-easy-crop, in natural image
 * pixels) to whole pixels, clamps it inside the image, and scales the output down so neither edge
 * exceeds `maxDimension` while preserving the crop's aspect ratio.
 */
export function getCropGeometry(
  crop: CropRect,
  image: { width: number; height: number },
  maxDimension = MAX_OUTPUT_DIMENSION,
): CropGeometry {
  const x = Math.min(Math.max(0, Math.round(crop.x)), image.width - 1);
  const y = Math.min(Math.max(0, Math.round(crop.y)), image.height - 1);
  const width = Math.max(1, Math.min(Math.round(crop.width), image.width - x));
  const height = Math.max(1, Math.min(Math.round(crop.height), image.height - y));

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    source: { x, y, width, height },
    output: {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    },
  };
}

/** `photo.png` → `photo.jpg`: the cropped upload is always JPEG, so the stored extension must match. */
export function croppedFileName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, '');
  return `${base || 'image'}.jpg`;
}

/**
 * Whether a picked file should go through the crop dialog. Videos bypass it, as do GIFs (a canvas
 * export would drop the animation) and SVGs (vector — nothing to gain from rasterizing).
 */
export function shouldOfferCrop(file: File): boolean {
  return file.type.startsWith('image/') && file.type !== 'image/gif' && file.type !== 'image/svg+xml';
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read the image'));
    img.src = src;
  });
}

/** Crops `file` to `crop` (natural-pixel coordinates) and returns a JPEG `File` for upload. */
export async function cropImageFile(file: File, crop: CropRect): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { source, output } = getCropGeometry(crop, { width: img.naturalWidth, height: img.naturalHeight });

    const canvas = document.createElement('canvas');
    canvas.width = output.width;
    canvas.height = output.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image cropping is not supported in this browser');
    // JPEG has no alpha — paint transparent areas (e.g. in PNGs) white rather than black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, output.width, output.height);
    ctx.drawImage(img, source.x, source.y, source.width, source.height, 0, 0, output.width, output.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('Could not crop the image');
    return new File([blob], croppedFileName(file.name), { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
}
