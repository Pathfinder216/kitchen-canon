import { describe, it, expect, vi, afterEach } from 'vitest';
import { downscaleImage, OCR_MAX_DIMENSION } from './ocr';

// jsdom has neither createImageBitmap nor a real canvas, so both are stubbed: these tests pin the
// sizing logic, not pixel output.
function stubBitmap(width: number, height: number) {
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width, height, close })));
  return close;
}

describe('downscaleImage', () => {
  const file = new Blob(['x'], { type: 'image/jpeg' });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('scales the longest edge down to the max dimension, preserving aspect ratio', async () => {
    const close = stubBitmap(4000, 3000);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);

    const result = await downscaleImage(file);

    expect(result).toBeInstanceOf(HTMLCanvasElement);
    const canvas = result as HTMLCanvasElement;
    expect(canvas.width).toBe(OCR_MAX_DIMENSION);
    expect(canvas.height).toBe(1200);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200);
    expect(close).toHaveBeenCalled();
  });

  it('handles portrait images by their height', async () => {
    stubBitmap(1500, 3000);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    const canvas = (await downscaleImage(file)) as HTMLCanvasElement;
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(OCR_MAX_DIMENSION);
  });

  it('returns the original file when it is already small enough', async () => {
    const close = stubBitmap(1200, 900);
    expect(await downscaleImage(file)).toBe(file);
    expect(close).toHaveBeenCalled();
  });

  it('falls back to the original file when the image cannot be decoded', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('bad image'); }));
    expect(await downscaleImage(file)).toBe(file);
  });

  it('falls back to the original file when createImageBitmap is unavailable', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    expect(await downscaleImage(file)).toBe(file);
  });
});
