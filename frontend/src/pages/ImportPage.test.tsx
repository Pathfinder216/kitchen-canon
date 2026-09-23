import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWithProviders } from '../test/utils';
import { ImportPage } from './ImportPage';
import { ApiError } from '../api/client';
import * as importApi from '../api/import';
import type { ParsedRecipe } from '../api/import';

vi.mock('../api/import');

// Never run real OCR in tests: tesseract.js is replaced by a fake worker that reports some
// progress and resolves canned text.
const OCR_TEXT = ['Pancakes', 'Ingredients', '1 cup flour', '1 egg', 'Directions', 'Mix and fry.'].join('\n');
const tesseractMock = vi.hoisted(() => ({
  createWorker: vi.fn(),
  recognize: vi.fn(),
  terminate: vi.fn(),
}));
vi.mock('tesseract.js', () => ({
  OEM: { LSTM_ONLY: 1 },
  createWorker: tesseractMock.createWorker,
}));

const mockedImportFromUrl = vi.mocked(importApi.importFromUrl);
const mockedImportFromText = vi.mocked(importApi.importFromText);

function baseParsedRecipe(overrides: Partial<ParsedRecipe> = {}): ParsedRecipe {
  return {
    title: 'Imported Chili',
    servings: 4,
    totalTime: 45,
    activeTime: null,
    source: 'https://example.com/chili',
    authorNotes: null,
    ingredients: [
      { name: 'beef', originalName: '2 lbs beef', amount: 2, unit: 'lb', isOptional: false, orderIndex: 0 },
    ],
    steps: [
      { orderIndex: 0, instruction: 'Brown the beef.', timeMinutes: null, isActiveTime: true },
    ],
    warnings: [],
    ...overrides,
  };
}

describe('ImportPage', () => {
  beforeEach(() => {
    mockedImportFromUrl.mockReset();
  });

  it('surfaces the backend error message on a failed URL import instead of a generic message', async () => {
    mockedImportFromUrl.mockRejectedValueOnce(
      new ApiError(400, 'The site blocked this request (HTTP 403) — many recipe sites reject automated imports.'),
    );
    renderWithProviders(<ImportPage />);

    await userEvent.type(screen.getByLabelText(/recipe url/i), 'https://example.com/recipe');
    await userEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => {
      expect(screen.getByText(/the site blocked this request \(http 403\)/i)).toBeInTheDocument();
    });
  });

  it('renders the backend-supplied warnings for fields the parser did not find', async () => {
    mockedImportFromUrl.mockResolvedValueOnce(
      baseParsedRecipe({
        totalTime: null,
        steps: [],
        warnings: [
          'No servings detected — defaulting to 4.',
          'No total time detected.',
          'No steps detected.',
        ],
      }),
    );
    renderWithProviders(<ImportPage />);

    await userEvent.type(screen.getByLabelText(/recipe url/i), 'https://example.com/recipe');
    await userEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => {
      expect(screen.getByText(/no servings detected/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/no total time detected/i)).toBeInTheDocument();
    expect(screen.getByText(/no steps detected/i)).toBeInTheDocument();
  });

  it('does not show a servings warning for a genuinely-parsed 4-serving recipe', async () => {
    // Regression guard: 4 is a common real-world yield. The banner must come from the
    // backend's `warnings` field (which knows whether 4 was parsed or defaulted), never from
    // the frontend re-deriving "servings === 4 means fallback".
    mockedImportFromUrl.mockResolvedValueOnce(baseParsedRecipe({ servings: 4, warnings: [] }));
    renderWithProviders(<ImportPage />);

    await userEvent.type(screen.getByLabelText(/recipe url/i), 'https://example.com/recipe');
    await userEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => {
      expect(screen.getByText('Imported Chili')).toBeInTheDocument();
    });
    expect(screen.queryByText(/no servings detected/i)).not.toBeInTheDocument();
  });

  it('does not show warnings when the parser found everything', async () => {
    mockedImportFromUrl.mockResolvedValueOnce(baseParsedRecipe({ servings: 6, warnings: [] }));
    renderWithProviders(<ImportPage />);

    await userEvent.type(screen.getByLabelText(/recipe url/i), 'https://example.com/recipe');
    await userEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => {
      expect(screen.getByText('Imported Chili')).toBeInTheDocument();
    });
    expect(screen.queryByText(/no servings detected/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no steps detected/i)).not.toBeInTheDocument();
  });
});

function LocationProbe() {
  const location = useLocation();
  const importData = (location.state as { importData?: ParsedRecipe } | null)?.importData;
  return <div data-testid="recipe-form">{importData?.title}</div>;
}

function renderImportRoutes() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<ImportPage />} />
      <Route path="/recipes/new" element={<LocationProbe />} />
    </Routes>,
  );
}

function photoFile() {
  return new File(['fake image bytes'], 'card.jpg', { type: 'image/jpeg' });
}

describe('ImportPage — photo (OCR) import', () => {
  beforeEach(() => {
    mockedImportFromText.mockReset();
    tesseractMock.createWorker.mockReset();
    tesseractMock.recognize.mockReset();
    tesseractMock.terminate.mockReset();
    tesseractMock.createWorker.mockImplementation(
      async (_langs: unknown, _oem: unknown, options: { logger: (m: { status: string; progress: number }) => void }) => {
        tesseractMock.recognize.mockImplementation(async () => {
          options.logger({ status: 'recognizing text', progress: 0.5 });
          // Trailing whitespace, as tesseract emits — the page trims it
          return { data: { text: `${OCR_TEXT}\n` } };
        });
        return { recognize: tesseractMock.recognize, terminate: tesseractMock.terminate };
      },
    );
  });

  it('OCRs a photo into editable text, parses it, and opens the pre-filled recipe form', async () => {
    mockedImportFromText.mockResolvedValueOnce(baseParsedRecipe({ title: 'Pancakes' }));
    renderImportRoutes();

    await userEvent.click(screen.getByRole('button', { name: /from photo/i }));
    const input = screen.getByLabelText(/recipe photo/i);
    // Phones get the camera offered
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(input).toHaveAttribute('capture', 'environment');

    await userEvent.upload(input, photoFile());

    const textarea = await screen.findByLabelText(/extracted text/i);
    expect(textarea).toHaveValue(OCR_TEXT);
    expect(tesseractMock.terminate).toHaveBeenCalled();

    // The user corrects an OCR mistake before parsing — the edited text is what gets sent.
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Pancakes{enter}2 cups flour');
    await userEvent.click(screen.getByRole('button', { name: /^parse$/i }));

    await waitFor(() => {
      expect(screen.getByTestId('recipe-form')).toHaveTextContent('Pancakes');
    });
    expect(mockedImportFromText).toHaveBeenCalledWith('Pancakes\n2 cups flour');
  });

  it('loads the tesseract worker, core and language data from self-hosted /ocr/ assets', async () => {
    renderImportRoutes();
    await userEvent.click(screen.getByRole('button', { name: /from photo/i }));
    await userEvent.upload(screen.getByLabelText(/recipe photo/i), photoFile());
    await screen.findByLabelText(/extracted text/i);

    expect(tesseractMock.createWorker).toHaveBeenCalledWith(
      'eng',
      1,
      expect.objectContaining({
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/',
        langPath: '/ocr/',
        // A blob: worker would be blocked by the production CSP (worker-src 'self')
        workerBlobURL: false,
      }),
    );
  });

  it('shows an error and keeps the page usable when OCR fails', async () => {
    tesseractMock.createWorker.mockRejectedValueOnce(new Error('network down'));
    renderImportRoutes();
    await userEvent.click(screen.getByRole('button', { name: /from photo/i }));
    await userEvent.upload(screen.getByLabelText(/recipe photo/i), photoFile());

    expect(await screen.findByText(/could not read the photo: network down/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/extracted text/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/recipe photo/i)).toBeEnabled();
  });

  it('surfaces a parse failure without leaving the review step', async () => {
    mockedImportFromText.mockRejectedValueOnce(new ApiError(400, 'Validation failed'));
    renderImportRoutes();
    await userEvent.click(screen.getByRole('button', { name: /from photo/i }));
    await userEvent.upload(screen.getByLabelText(/recipe photo/i), photoFile());
    await screen.findByLabelText(/extracted text/i);

    await userEvent.click(screen.getByRole('button', { name: /^parse$/i }));

    expect(await screen.findByText(/validation failed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/extracted text/i)).toHaveValue(OCR_TEXT);
    expect(screen.queryByTestId('recipe-form')).not.toBeInTheDocument();
  });
});
