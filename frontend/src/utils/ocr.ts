// Client-side OCR for the photo import (plan 32). tesseract.js is loaded with a dynamic import()
// so its JS only lands in a separate chunk fetched when the user actually picks a photo; its
// worker, WASM core and English language data are all self-hosted under /ocr/ (see the
// `tesseractAssets` plugin in vite.config.ts and public/ocr/eng.traineddata.gz). Nothing is
// fetched from a CDN, which keeps the feature working offline and under the production CSP.

/** Longest image edge fed to tesseract. Phone photos are 3–5k px; 1600 keeps printed text legible
 *  while cutting recognition time several-fold. */
export const OCR_MAX_DIMENSION = 1600;

const OCR_BASE = `${import.meta.env.BASE_URL}ocr/`;

export type OcrProgress = {
  /** tesseract's status string, e.g. "loading language traineddata", "recognizing text". */
  status: string;
  /** 0–1 progress within the current status. */
  progress: number;
};

/**
 * Downscale an image so its longest edge is at most `maxDimension`, returning a canvas tesseract
 * can read directly. Returns the original file when it's already small enough, or when the browser
 * can't decode it via createImageBitmap (tesseract then gets the file as-is).
 */
export async function downscaleImage(
  file: Blob,
  maxDimension = OCR_MAX_DIMENSION,
): Promise<Blob | HTMLCanvasElement> {
  if (typeof createImageBitmap !== 'function') return file;
  let bitmap: ImageBitmap;
  try {
    // 'from-image' applies EXIF orientation, so portrait phone photos aren't OCR'd sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

/** Run OCR on an image file and return the recognized text. */
export async function recognizeImage(
  file: Blob,
  onProgress?: (p: OcrProgress) => void,
): Promise<string> {
  const [{ createWorker, OEM }, image] = await Promise.all([
    import('tesseract.js'),
    downscaleImage(file),
  ]);
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: `${OCR_BASE}worker.min.js`,
    // A directory: the worker picks the relaxed-SIMD / SIMD / plain LSTM core the device supports.
    corePath: OCR_BASE,
    langPath: OCR_BASE,
    // Spawn the worker straight from its same-origin URL. The default wraps it in a blob: URL,
    // which the production CSP's worker-src 'self' would block.
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => onProgress?.({ status: m.status, progress: m.progress }),
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}
