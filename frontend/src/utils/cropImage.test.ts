import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getCropGeometry,
  croppedFileName,
  shouldOfferCrop,
  cropImageFile,
  JPEG_QUALITY,
} from './cropImage';

describe('getCropGeometry', () => {
  const image = { width: 4000, height: 3000 };

  it('outputs a canvas the size of the crop rect', () => {
    const g = getCropGeometry({ x: 100, y: 200, width: 1200, height: 900 }, image);
    expect(g.source).toEqual({ x: 100, y: 200, width: 1200, height: 900 });
    expect(g.output).toEqual({ width: 1200, height: 900 });
  });

  it('rounds fractional crop rects to whole pixels', () => {
    const g = getCropGeometry({ x: 10.4, y: 20.6, width: 300.5, height: 199.4 }, image);
    expect(g.source).toEqual({ x: 10, y: 21, width: 301, height: 199 });
    expect(g.output).toEqual({ width: 301, height: 199 });
  });

  it('clamps a crop that spills past the image edges', () => {
    const g = getCropGeometry({ x: -5, y: 2900, width: 4100, height: 400 }, image);
    expect(g.source).toEqual({ x: 0, y: 2900, width: 4000, height: 100 });
    expect(g.output).toEqual({ width: 4000, height: 100 });
  });

  it('scales the output down to the max dimension, preserving aspect ratio', () => {
    const g = getCropGeometry({ x: 0, y: 0, width: 8000, height: 6000 }, { width: 8000, height: 6000 }, 4096);
    expect(g.source).toEqual({ x: 0, y: 0, width: 8000, height: 6000 });
    expect(g.output).toEqual({ width: 4096, height: 3072 });
  });

  it('never produces a zero-sized canvas', () => {
    const g = getCropGeometry({ x: 0, y: 0, width: 0.2, height: 0.2 }, image);
    expect(g.output).toEqual({ width: 1, height: 1 });
  });
});

describe('croppedFileName', () => {
  it('keeps the original name with a .jpg extension', () => {
    expect(croppedFileName('pasta.png')).toBe('pasta.jpg');
    expect(croppedFileName('IMG_0001.JPEG')).toBe('IMG_0001.jpg');
    expect(croppedFileName('my.lovely.cake.webp')).toBe('my.lovely.cake.jpg');
    expect(croppedFileName('noext')).toBe('noext.jpg');
  });
});

describe('shouldOfferCrop', () => {
  const f = (type: string) => new File(['x'], 'f', { type });
  it('offers crop for raster images only', () => {
    expect(shouldOfferCrop(f('image/jpeg'))).toBe(true);
    expect(shouldOfferCrop(f('image/png'))).toBe(true);
    expect(shouldOfferCrop(f('image/webp'))).toBe(true);
    expect(shouldOfferCrop(f('video/mp4'))).toBe(false);
    expect(shouldOfferCrop(f('image/gif'))).toBe(false);
    expect(shouldOfferCrop(f('image/svg+xml'))).toBe(false);
  });
});

describe('cropImageFile', () => {
  const { createObjectURL, revokeObjectURL } = URL;
  afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('draws the crop rect onto a canvas of matching size and returns a JPEG File', async () => {
    // jsdom can't decode images or rasterize canvases — stub both.
    URL.createObjectURL = vi.fn(() => 'blob:source');
    URL.revokeObjectURL = vi.fn();
    class FakeImage {
      naturalWidth = 2000;
      naturalHeight = 1500;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal('Image', FakeImage);

    const drawImage = vi.fn();
    const fillRect = vi.fn();
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      (() => ({ drawImage, fillRect, fillStyle: '' })) as unknown as HTMLCanvasElement['getContext'],
    );
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => {
      cb(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }));
    });

    const source = new File(['png-bytes'], 'soup.png', { type: 'image/png' });
    const result = await cropImageFile(source, { x: 100, y: 50, width: 800, height: 600 });

    const canvas = getContext.mock.contexts[0] as HTMLCanvasElement;
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
    expect(drawImage).toHaveBeenCalledWith(expect.any(FakeImage), 100, 50, 800, 600, 0, 0, 800, 600);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', JPEG_QUALITY);
    expect(result).toBeInstanceOf(File);
    expect(result.name).toBe('soup.jpg');
    expect(result.type).toBe('image/jpeg');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:source');
  });
});
