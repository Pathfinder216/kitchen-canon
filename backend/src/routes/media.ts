import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Ensure media storage directory exists
fs.mkdirSync(config.MEDIA_STORAGE_PATH, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.MEDIA_STORAGE_PATH);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  },
});

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// POST /api/recipes/:id/media — upload image/video for a recipe
router.post(
  '/recipes/:id/media',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const recipe = await prisma.recipe.findFirst({ where: { id: req.params.id as string, userId: req.userId } });
    if (!recipe) {
      fs.unlinkSync(req.file.path);
      throw new AppError(404, 'Recipe not found');
    }

    const type = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    const media = await prisma.media.create({
      data: {
        type,
        path: `/media/${req.file.filename}`,
        recipeId: req.params.id as string,
        orderIndex: 0,
      },
    });

    res.status(201).json(media);
  }),
);

// GET /api/recipes/:id/media — list media for a recipe
router.get(
  '/recipes/:id/media',
  asyncHandler(async (req, res) => {
    const recipe = await prisma.recipe.findFirst({ where: { id: req.params.id as string, userId: req.userId } });
    if (!recipe) throw new AppError(404, 'Recipe not found');

    const media = await prisma.media.findMany({
      where: { recipeId: req.params.id as string },
      orderBy: { orderIndex: 'asc' },
    });
    res.json(media);
  }),
);

// DELETE /api/recipes/:id/media/:mediaId — delete a media item
router.delete(
  '/recipes/:id/media/:mediaId',
  asyncHandler(async (req, res) => {
    const media = await prisma.media.findFirst({
      where: { id: req.params.mediaId as string, recipeId: req.params.id as string, recipe: { userId: req.userId } },
    });
    if (!media) throw new AppError(404, 'Media not found');

    // Delete the file from disk
    const filePath = path.join(config.MEDIA_STORAGE_PATH, path.basename(media.path));
    try { fs.unlinkSync(filePath); } catch { /* file may not exist */ }

    await prisma.media.delete({ where: { id: media.id } });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Step-level media routes
// ---------------------------------------------------------------------------

// POST /api/steps/:stepId/media — upload image or video for a step
router.post(
  '/steps/:stepId/media',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const step = await prisma.step.findFirst({ where: { id: req.params.stepId as string, recipe: { userId: req.userId } } });
    if (!step) {
      fs.unlinkSync(req.file.path);
      throw new AppError(404, 'Step not found');
    }

    // Replace any existing media for this step (one slot per step)
    const existing = await prisma.media.findFirst({ where: { stepId: req.params.stepId as string } });
    if (existing) {
      const oldPath = path.join(config.MEDIA_STORAGE_PATH, path.basename(existing.path));
      try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
      await prisma.media.delete({ where: { id: existing.id } });
    }

    const type = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    const media = await prisma.media.create({
      data: {
        type,
        path: `/media/${req.file.filename}`,
        stepId: req.params.stepId as string,
        orderIndex: 0,
      },
    });

    res.status(201).json(media);
  }),
);

// GET /api/steps/:stepId/media — get the single media item for a step
router.get(
  '/steps/:stepId/media',
  asyncHandler(async (req, res) => {
    const step = await prisma.step.findFirst({ where: { id: req.params.stepId as string, recipe: { userId: req.userId } } });
    if (!step) throw new AppError(404, 'Step not found');

    const media = await prisma.media.findFirst({ where: { stepId: req.params.stepId as string } });
    res.json(media ?? null);
  }),
);

// DELETE /api/steps/:stepId/media/:mediaId — delete step media
router.delete(
  '/steps/:stepId/media/:mediaId',
  asyncHandler(async (req, res) => {
    const media = await prisma.media.findFirst({
      where: { id: req.params.mediaId as string, stepId: req.params.stepId as string, step: { recipe: { userId: req.userId } } },
    });
    if (!media) throw new AppError(404, 'Media not found');

    const filePath = path.join(config.MEDIA_STORAGE_PATH, path.basename(media.path));
    try { fs.unlinkSync(filePath); } catch { /* file may not exist */ }

    await prisma.media.delete({ where: { id: media.id } });
    res.status(204).send();
  }),
);

export default router;
