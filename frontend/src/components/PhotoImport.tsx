import { useEffect, useState, type ChangeEvent } from 'react';
import { importFromText, type ParsedRecipe } from '../api/import';
import { recognizeImage, type OcrProgress } from '../utils/ocr';

type Phase = 'idle' | 'ocr' | 'review' | 'parsing';

const STATUS_LABELS: Record<string, string> = {
  'loading tesseract core': 'Loading OCR engine…',
  'loading language traineddata': 'Loading language data…',
  'recognizing text': 'Reading text…',
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? 'Preparing…';
}

/**
 * Photo import (plan 32): OCR a photo of a recipe card in the browser, let the user fix the text,
 * then send it to the backend text parser. The image itself never leaves the device.
 */
export function PhotoImport({ onParsed }: { onParsed: (recipe: ParsedRecipe) => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Release the thumbnail's object URL when it's replaced or the component unmounts.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setText('');
    setProgress({ status: 'starting', progress: 0 });
    setPhase('ocr');
    setPhotoUrl(typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null);
    try {
      const recognized = await recognizeImage(file, setProgress);
      setText(recognized);
      setPhase('review');
      if (!recognized) {
        setError('No text was found in that photo. Try a sharper, well-lit shot — or type the recipe below.');
      }
    } catch (err) {
      setError(err instanceof Error ? `Could not read the photo: ${err.message}` : 'Could not read the photo');
      setPhase('idle');
    }
  }

  async function handleParse() {
    if (!text.trim()) {
      setError('There is no text to parse');
      return;
    }
    setError('');
    setPhase('parsing');
    try {
      onParsed(await importFromText(text));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setPhase('review');
    }
  }

  const percent = Math.round((progress?.progress ?? 0) * 100);

  return (
    <div className="mb-4">
      <label htmlFor="import-photo" className="block text-sm font-medium text-gray-700 mb-1">
        Recipe photo
      </label>
      <input
        id="import-photo"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhoto}
        disabled={phase === 'ocr' || phase === 'parsing'}
        className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 disabled:opacity-60"
      />
      <p className="text-xs text-gray-400 mt-1">
        Snap or choose a photo of a printed recipe card or cookbook page. Text is read on this device;
        handwriting usually won&apos;t come out well.
      </p>

      {phase === 'ocr' && progress && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{statusLabel(progress.status)}</span>
            <span>{percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Text recognition progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2 bg-gray-100 rounded-full overflow-hidden"
          >
            <div className="h-full bg-orange-500 transition-[width]" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {(phase === 'review' || phase === 'parsing') && (
        <div className="mt-4">
          <div className="flex gap-4 items-start">
            {photoUrl && (
              <img
                src={photoUrl}
                alt="Recipe photo"
                className="hidden sm:block w-40 rounded-md border border-gray-200 object-contain"
              />
            )}
            <div className="flex-1">
              <label htmlFor="ocr-text" className="block text-sm font-medium text-gray-700 mb-1">
                Extracted text
              </label>
              <textarea
                id="ocr-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                Fix any misread words first. Best results: title on the first line, then
                &quot;Ingredients&quot; and &quot;Directions&quot; headings.
              </p>
            </div>
          </div>
          <button
            onClick={handleParse}
            disabled={phase === 'parsing'}
            className="mt-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
          >
            {phase === 'parsing' ? 'Parsing...' : 'Parse'}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
