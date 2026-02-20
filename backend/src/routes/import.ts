import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { importFromDocx, importFromPdf, importFromUrl } from '../services/import.service.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

const urlSchema = z.object({ url: z.string().url() });

// POST /api/import/url
router.post(
  '/url',
  asyncHandler(async (req, res) => {
    const { url } = urlSchema.parse(req.body);
    const recipe = await importFromUrl(url);
    res.json(recipe);
  }),
);

// POST /api/import/file  (multipart, field name: "file")
router.post(
  '/file',
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
      const { parseTextRecipe } = await import('../services/import.service.js');
      recipe = parseTextRecipe(buffer.toString('utf-8'));
    } else {
      res.status(400).json({ error: 'Unsupported file type. Supported: .docx, .pdf, .txt' });
      return;
    }

    res.json(recipe);
  }),
);

export default router;
