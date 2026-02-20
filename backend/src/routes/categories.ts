import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { validate } from '../middleware/validate.js';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
});

// GET /api/categories
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  }),
);

// POST /api/categories
router.post(
  '/',
  validate(createCategorySchema),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.create({
      data: { name: req.body.name },
    });
    res.status(201).json(category);
  }),
);

export default router;
