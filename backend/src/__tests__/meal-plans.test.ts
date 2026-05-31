import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { createAuthedApi, cleanupUsers, type AuthedApi } from './helpers/auth.js';

const app = createApp();
let api: AuthedApi;

let recipe1Id: string;
let recipe2Id: string;

beforeEach(async () => {
  await cleanupUsers();
  api = await createAuthedApi(app);

  // Create test recipes
  const r1 = await api.post('/api/recipes').send({
    title: 'Pasta',
    servings: 4,
    ingredients: [
      { name: 'pasta', amount: 1, unit: 'lb', orderIndex: 0 },
      { name: 'olive oil', amount: 2, unit: 'tbsp', orderIndex: 1 },
      { name: 'garlic', amount: 3, unit: 'cloves', orderIndex: 2 },
    ],
    steps: [
      { orderIndex: 0, instruction: 'Boil pasta.', timeMinutes: 10, isActiveTime: false },
      { orderIndex: 1, instruction: 'Make sauce.', timeMinutes: 5, isActiveTime: true },
    ],
  });
  recipe1Id = r1.body.id;

  const r2 = await api.post('/api/recipes').send({
    title: 'Salad',
    servings: 2,
    ingredients: [
      { name: 'lettuce', amount: 1, unit: 'head', orderIndex: 0 },
      { name: 'olive oil', amount: 1, unit: 'tbsp', orderIndex: 1 },
    ],
    steps: [
      { orderIndex: 0, instruction: 'Toss salad.', timeMinutes: 5, isActiveTime: true },
    ],
  });
  recipe2Id = r2.body.id;
});

describe('POST /api/meal-plans', () => {
  it('creates a meal plan with recipes and grocery list', async () => {
    const res = await api.post('/api/meal-plans').send({
      name: 'Tuesday Dinner',
      recipes: [
        { recipeId: recipe1Id, servings: 4 },
        { recipeId: recipe2Id, servings: 2 },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Tuesday Dinner');
    expect(res.body.recipes).toHaveLength(2);
    expect(res.body.groceryList).toBeDefined();
    expect(res.body.groceryList.length).toBeGreaterThan(0);

    // Olive oil should be consolidated (2 tbsp + 1 tbsp = 3 tbsp)
    const oilItem = res.body.groceryList.find(
      (item: { ingredient: string }) => item.ingredient === 'olive oil',
    );
    expect(oilItem).toBeDefined();
    expect(oilItem.amount).toBe(3);
  });

  it('scales grocery list when servings differ from recipe default', async () => {
    const res = await api.post('/api/meal-plans').send({
      recipes: [
        { recipeId: recipe1Id, servings: 8 }, // double the pasta
      ],
    });

    expect(res.status).toBe(201);
    const pastaItem = res.body.groceryList.find(
      (item: { ingredient: string }) => item.ingredient === 'pasta',
    );
    expect(pastaItem.amount).toBe(2); // 1 lb * 2 = 2 lb
  });

  it('rejects invalid recipe IDs', async () => {
    const res = await api.post('/api/meal-plans').send({
      recipes: [{ recipeId: 'non-existent', servings: 4 }],
    });

    expect(res.status).toBe(400);
  });

  it('rejects empty recipes array', async () => {
    const res = await api.post('/api/meal-plans').send({
      recipes: [],
    });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/meal-plans', () => {
  it('lists meal plans', async () => {
    await api.post('/api/meal-plans').send({
      name: 'Meal 1',
      recipes: [{ recipeId: recipe1Id, servings: 4 }],
    });
    await api.post('/api/meal-plans').send({
      name: 'Meal 2',
      recipes: [{ recipeId: recipe2Id, servings: 2 }],
    });

    const res = await api.get('/api/meal-plans');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('GET /api/meal-plans/:id', () => {
  it('returns meal plan with full recipe data', async () => {
    const createRes = await api.post('/api/meal-plans').send({
      recipes: [
        { recipeId: recipe1Id, servings: 4 },
        { recipeId: recipe2Id, servings: 2 },
      ],
    });

    const res = await api.get(`/api/meal-plans/${createRes.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.recipes[0].recipe.ingredients).toHaveLength(3);
    expect(res.body.recipes[0].recipe.steps).toHaveLength(2);
  });
});

describe('PATCH /api/meal-plans/:id/grocery/:itemId', () => {
  it('toggles grocery item purchased status', async () => {
    const createRes = await api.post('/api/meal-plans').send({
      recipes: [{ recipeId: recipe1Id, servings: 4 }],
    });

    const itemId = createRes.body.groceryList[0].id;

    const res = await api
      .patch(`/api/meal-plans/${createRes.body.id}/grocery/${itemId}`)
      .send({ purchased: true });

    expect(res.status).toBe(200);
    expect(res.body.purchased).toBe(true);

    // Toggle back
    const res2 = await api
      .patch(`/api/meal-plans/${createRes.body.id}/grocery/${itemId}`)
      .send({ purchased: false });

    expect(res2.body.purchased).toBe(false);
  });
});

describe('POST /api/meal-plans/:id/remake', () => {
  it('creates a new meal plan from an existing one', async () => {
    const createRes = await api.post('/api/meal-plans').send({
      name: 'Original Meal',
      recipes: [
        { recipeId: recipe1Id, servings: 4 },
        { recipeId: recipe2Id, servings: 2 },
      ],
    });

    const res = await api.post(`/api/meal-plans/${createRes.body.id}/remake`);

    expect(res.status).toBe(201);
    expect(res.body.id).not.toBe(createRes.body.id);
    expect(res.body.name).toBe('Original Meal (remake)');
    expect(res.body.recipes).toHaveLength(2);
    expect(res.body.groceryList.length).toBeGreaterThan(0);

    // All grocery items should be unpurchased
    for (const item of res.body.groceryList) {
      expect(item.purchased).toBe(false);
    }
  });
});
