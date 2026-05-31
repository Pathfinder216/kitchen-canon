import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CourseType } from '@prisma/client';
import { prisma } from '../db.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

const createLabelSchema = z.object({
  type: z.enum(['manual']),
  name: z.string().min(1).max(100),
});

const assignLabelsSchema = z.object({
  labelIds: z.array(z.string()),
});

const assignCoursesSchema = z.object({
  courseTypes: z.array(z.nativeEnum(CourseType)),
});

// GET /api/labels — global labels plus the user's own
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const type = req.query.type as string | undefined;
    const labels = await prisma.label.findMany({
      where: {
        ...(type ? { type } : {}),
        OR: [{ userId: null }, { userId: req.userId }],
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    res.json(labels);
  }),
);

// POST /api/labels — create a user's own manual label (reusing a matching global/own label)
router.post(
  '/',
  validate(createLabelSchema),
  asyncHandler(async (req, res) => {
    const { type, name } = req.body as { type: string; name: string };
    // Reuse an existing global or own label with the same type+name instead of duplicating.
    const existing = await prisma.label.findFirst({
      where: { type, name, OR: [{ userId: null }, { userId: req.userId }] },
    });
    if (existing) {
      res.status(200).json(existing);
      return;
    }
    const label = await prisma.label.create({ data: { type, name, userId: req.userId } });
    res.status(201).json(label);
  }),
);

// POST /api/recipes/:id/labels — assign labels to a recipe
router.post(
  '/recipes/:id/labels',
  validate(assignLabelsSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { labelIds } = req.body;

    const recipe = await prisma.recipe.findFirst({ where: { id, userId: req.userId } });
    if (!recipe) throw new AppError(404, 'Recipe not found');

    // Only allow attaching global or own labels.
    if (labelIds.length > 0) {
      const allowed = await prisma.label.count({
        where: { id: { in: labelIds }, OR: [{ userId: null }, { userId: req.userId }] },
      });
      if (allowed !== labelIds.length) throw new AppError(400, 'One or more labels not found');
    }

    // Replace manually-assigned labels; preserve dietary/allergen labels computed from ingredients
    const manualLabelIds = (
      await prisma.label.findMany({
        where: { type: 'manual', OR: [{ userId: null }, { userId: req.userId }] },
        select: { id: true },
      })
    ).map((l) => l.id);
    await prisma.$transaction([
      prisma.recipeLabel.deleteMany({ where: { recipeId: id, labelId: { in: manualLabelIds } } }),
      ...labelIds.map((labelId: string) =>
        prisma.recipeLabel.create({ data: { recipeId: id, labelId } }),
      ),
    ]);

    const updated = await prisma.recipe.findUnique({
      where: { id },
      include: {
        labels: { include: { label: true } },
        ingredients: { orderBy: { orderIndex: 'asc' } },
        steps: { orderBy: { orderIndex: 'asc' } },
      },
    });

    res.json(updated);
  }),
);

// POST /api/recipes/:id/courses — assign courses to a recipe
router.post(
  '/recipes/:id/courses',
  validate(assignCoursesSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { courseTypes } = req.body;

    const recipe = await prisma.recipe.findFirst({ where: { id, userId: req.userId } });
    if (!recipe) throw new AppError(404, 'Recipe not found');

    await prisma.$transaction([
      prisma.recipeCourse.deleteMany({ where: { recipeId: id } }),
      ...courseTypes.map((courseType: CourseType) =>
        prisma.recipeCourse.create({
          data: { recipeId: id, courseType },
        }),
      ),
    ]);

    const updated = await prisma.recipe.findUnique({
      where: { id },
      include: {
        courses: true,
        ingredients: { orderBy: { orderIndex: 'asc' } },
        steps: { orderBy: { orderIndex: 'asc' } },
      },
    });

    res.json(updated);
  }),
);

export default router;
