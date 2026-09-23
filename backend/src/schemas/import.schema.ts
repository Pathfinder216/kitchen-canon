import { z } from 'zod';

export const importUrlSchema = z.object({ url: z.string().url() });

// Plain text for the heuristic text parser — used by the photo/OCR import (plan 32), where the
// browser does the OCR and the user corrects the text before sending it. Capped well above any
// real recipe so an oversized paste can't tie up the parser.
export const IMPORT_TEXT_MAX_LENGTH = 50_000;

export const importTextSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Text is required')
    .max(IMPORT_TEXT_MAX_LENGTH, `Text must be at most ${IMPORT_TEXT_MAX_LENGTH} characters`),
});
