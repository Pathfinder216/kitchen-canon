import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  importFromDocx,
  importFromPdf,
  importFromUrl,
  parseTextRecipe,
} from '../services/import.service.js';
import { importLimiter } from '../middleware/rateLimits.js';
import { validate } from '../middleware/validate.js';
import { importTextSchema, importUrlSchema } from '../schemas/import.schema.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// POST /api/import/url
router.post(
  '/url',
  importLimiter,
  asyncHandler(async (req, res) => {
    const { url } = importUrlSchema.parse(req.body);
    const recipe = await importFromUrl(url);
    res.json(recipe);
  }),
);

// POST /api/import/text  { text }
// Parses already-extracted plain text: the photo/OCR import (plan 32) runs tesseract in the
// browser and sends the user-corrected text here. Deliberately not behind importLimiter — there is
// no outbound fetch or document decoding, just the in-process heuristic parser on length-capped
// input — and users naturally re-parse a few times while fixing OCR mistakes.
router.post(
  '/text',
  validate(importTextSchema),
  asyncHandler(async (req, res) => {
    const { text } = req.body as { text: string };
    res.json(parseTextRecipe(text));
  }),
);

// POST /api/import/file  (multipart, field name: "file")
router.post(
  '/file',
  importLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { mimetype, buffer, originalname } = req.file;
    const ext = originalname.split('.').pop()?.toLowerCase() ?? '';

    let recipe;
    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx'
    ) {
      recipe = await importFromDocx(buffer);
    } else if (mimetype === 'application/pdf' || ext === 'pdf') {
      recipe = await importFromPdf(buffer);
    } else if (mimetype.startsWith('text/')) {
      recipe = parseTextRecipe(buffer.toString('utf-8'));
    } else {
      res.status(400).json({ error: 'Unsupported file type. Supported: .docx, .pdf, .txt' });
      return;
    }

    res.json(recipe);
  }),
);

export default router;
