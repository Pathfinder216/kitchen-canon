import { Router } from 'express';

const router = Router();

const COURSES = [
  { type: 'APPETIZER', name: 'Appetizer' },
  { type: 'SOUP',      name: 'Soup' },
  { type: 'SALAD',     name: 'Salad' },
  { type: 'BREAD',     name: 'Bread' },
  { type: 'MAIN',      name: 'Main Course' },
  { type: 'SIDE',      name: 'Side Dish' },
  { type: 'DESSERT',   name: 'Dessert' },
  { type: 'BREAKFAST', name: 'Breakfast' },
  { type: 'SNACK',     name: 'Snack' },
  { type: 'DRINK',     name: 'Drink' },
  { type: 'TOPPING',   name: 'Topping / Condiment' },
];

// GET /api/courses
router.get('/', (_req, res) => {
  res.json(COURSES);
});

export default router;
