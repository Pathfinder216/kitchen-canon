import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../db.js';

const app = createApp();

const sampleRecipe = {
  title: 'Scrambled Eggs',
  servings: 2,
  source: 'https://example.com/scrambled-eggs',
  authorNotes: 'Use low heat for creamier eggs',
  ingredients: [
    { name: 'eggs', amount: 4, unit: 'large', isOptional: false, orderIndex: 0, internalId: 'eggs_1' },
    { name: 'butter', amount: 1, unit: 'tbsp', isOptional: false, orderIndex: 1, internalId: 'butter_1' },
    { name: 'salt', amount: 0.25, unit: 'tsp', isOptional: false, orderIndex: 2, internalId: 'salt_1' },
    { name: 'chives', amount: 1, unit: 'tbsp', isOptional: true, orderIndex: 3, internalId: 'chives_1' },
  ],
  steps: [
    { orderIndex: 0, instruction: 'Crack {eggs_1:100%} into a bowl and whisk.', timeMinutes: 2, isActiveTime: true },
    { orderIndex: 1, instruction: 'Melt {butter_1:100%} in a non-stick pan over low heat.', timeMinutes: 1, isActiveTime: true },
    { orderIndex: 2, instruction: 'Pour in eggs and stir gently until just set.', timeMinutes: 5, isActiveTime: true },
    { orderIndex: 3, instruction: 'Season with {salt_1:100%} and top with {chives_1:100%}.', timeMinutes: 1, isActiveTime: true },
  ],
};

beforeEach(async () => {
  // Clean database before each test
  await prisma.step.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.recipe.deleteMany();
});

describe('POST /api/recipes', () => {
  it('creates a recipe with ingredients and steps', async () => {
    const res = await request(app).post('/api/recipes').send(sampleRecipe);

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Scrambled Eggs');
    expect(res.body.servings).toBe(2);
    expect(res.body.version).toBe(1);
    expect(res.body.isLatest).toBe(true);
    expect(res.body.archived).toBe(false);
    expect(res.body.ingredients).toHaveLength(4);
    expect(res.body.steps).toHaveLength(4);
    expect(res.body.authorNotes).toBe('Use low heat for creamier eggs');
  });

  it('creates a minimal recipe with just a title', async () => {
    const res = await request(app).post('/api/recipes').send({ title: 'Quick Salad' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Quick Salad');
    expect(res.body.servings).toBe(1);
    expect(res.body.ingredients).toHaveLength(0);
    expect(res.body.steps).toHaveLength(0);
  });

  it('rejects a recipe without a title', async () => {
    const res = await request(app).post('/api/recipes').send({ servings: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('rejects a recipe with invalid servings', async () => {
    const res = await request(app).post('/api/recipes').send({ title: 'Test', servings: -1 });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/recipes', () => {
  it('returns an empty list initially', async () => {
    const res = await request(app).get('/api/recipes');

    expect(res.status).toBe(200);
    expect(res.body.recipes).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
  });

  it('returns created recipes', async () => {
    await request(app).post('/api/recipes').send(sampleRecipe);
    await request(app).post('/api/recipes').send({ title: 'Toast' });

    const res = await request(app).get('/api/recipes');

    expect(res.status).toBe(200);
    expect(res.body.recipes).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
  });

  it('supports pagination', async () => {
    // Create 3 recipes
    await request(app).post('/api/recipes').send({ title: 'Recipe 1' });
    await request(app).post('/api/recipes').send({ title: 'Recipe 2' });
    await request(app).post('/api/recipes').send({ title: 'Recipe 3' });

    const res = await request(app).get('/api/recipes?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.recipes).toHaveLength(2);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.totalPages).toBe(2);

    const res2 = await request(app).get('/api/recipes?page=2&limit=2');
    expect(res2.body.recipes).toHaveLength(1);
  });

  it('supports search by title', async () => {
    await request(app).post('/api/recipes').send({ title: 'Chicken Soup' });
    await request(app).post('/api/recipes').send({ title: 'Tomato Soup' });
    await request(app).post('/api/recipes').send({ title: 'Grilled Chicken' });

    const res = await request(app).get('/api/recipes?search=Chicken');

    expect(res.status).toBe(200);
    expect(res.body.recipes).toHaveLength(2);
  });

  it('excludes archived recipes by default', async () => {
    const createRes = await request(app).post('/api/recipes').send({ title: 'To Archive' });
    await request(app).delete(`/api/recipes/${createRes.body.id}`);

    const res = await request(app).get('/api/recipes');
    expect(res.body.recipes).toHaveLength(0);

    const resArchived = await request(app).get('/api/recipes?archived=true');
    expect(resArchived.body.recipes).toHaveLength(1);
  });

  it('only returns latest versions', async () => {
    const createRes = await request(app).post('/api/recipes').send(sampleRecipe);
    await request(app).patch(`/api/recipes/${createRes.body.id}`).send({ title: 'Updated Eggs' });

    const res = await request(app).get('/api/recipes');
    expect(res.body.recipes).toHaveLength(1);
    expect(res.body.recipes[0].title).toBe('Updated Eggs');
  });
});

describe('GET /api/recipes/:id', () => {
  it('returns a recipe by ID', async () => {
    const createRes = await request(app).post('/api/recipes').send(sampleRecipe);
    const res = await request(app).get(`/api/recipes/${createRes.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Scrambled Eggs');
    expect(res.body.ingredients).toHaveLength(4);
    expect(res.body.steps).toHaveLength(4);
  });

  it('returns 404 for non-existent recipe', async () => {
    const res = await request(app).get('/api/recipes/non-existent-id');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Recipe not found');
  });
});

describe('PATCH /api/recipes/:id', () => {
  it('updates a recipe and creates a new version', async () => {
    const createRes = await request(app).post('/api/recipes').send(sampleRecipe);
    const originalId = createRes.body.id;

    const updateRes = await request(app)
      .patch(`/api/recipes/${originalId}`)
      .send({ title: 'Creamy Scrambled Eggs', personalNotes: 'Even better with cream cheese' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.title).toBe('Creamy Scrambled Eggs');
    expect(updateRes.body.version).toBe(2);
    expect(updateRes.body.isLatest).toBe(true);
    expect(updateRes.body.parentId).toBe(originalId);
    expect(updateRes.body.personalNotes).toBe('Even better with cream cheese');
    // Original ingredients should be preserved
    expect(updateRes.body.ingredients).toHaveLength(4);
  });

  it('updates ingredients when provided', async () => {
    const createRes = await request(app).post('/api/recipes').send(sampleRecipe);

    const newIngredients = [
      { name: 'eggs', amount: 6, unit: 'large', isOptional: false, orderIndex: 0, internalId: 'eggs_1' },
      { name: 'cream', amount: 2, unit: 'tbsp', isOptional: false, orderIndex: 1, internalId: 'cream_1' },
    ];

    const updateRes = await request(app)
      .patch(`/api/recipes/${createRes.body.id}`)
      .send({ ingredients: newIngredients });

    expect(updateRes.body.ingredients).toHaveLength(2);
    expect(updateRes.body.ingredients[0].amount).toBe(6);
  });

  it('returns 404 for non-existent recipe', async () => {
    const res = await request(app).patch('/api/recipes/non-existent').send({ title: 'Test' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/recipes/:id (archive toggle)', () => {
  it('archives a recipe', async () => {
    const createRes = await request(app).post('/api/recipes').send(sampleRecipe);
    const res = await request(app).delete(`/api/recipes/${createRes.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.archived).toBe(true);
  });

  it('unarchives an archived recipe', async () => {
    const createRes = await request(app).post('/api/recipes').send(sampleRecipe);
    await request(app).delete(`/api/recipes/${createRes.body.id}`);
    const res = await request(app).delete(`/api/recipes/${createRes.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.archived).toBe(false);
  });

  it('returns 404 for non-existent recipe', async () => {
    const res = await request(app).delete('/api/recipes/non-existent');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/recipes/:id/versions', () => {
  it('returns version history for a recipe', async () => {
    const createRes = await request(app).post('/api/recipes').send(sampleRecipe);
    const v1Id = createRes.body.id;

    const updateRes = await request(app)
      .patch(`/api/recipes/${v1Id}`)
      .send({ title: 'Updated Eggs' });
    const v2Id = updateRes.body.id;

    await request(app).patch(`/api/recipes/${v2Id}`).send({ title: 'Final Eggs' });

    // Can get versions from any version ID in the chain
    const res = await request(app).get(`/api/recipes/${v1Id}/versions`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].version).toBe(1);
    expect(res.body[0].title).toBe('Scrambled Eggs');
    expect(res.body[1].version).toBe(2);
    expect(res.body[1].title).toBe('Updated Eggs');
    expect(res.body[2].version).toBe(3);
    expect(res.body[2].title).toBe('Final Eggs');
  });
});

describe('POST /api/recipes/:id/restore/:version', () => {
  it('restores an old version as a new version', async () => {
    const createRes = await request(app).post('/api/recipes').send(sampleRecipe);
    const v1Id = createRes.body.id;

    const updateRes = await request(app)
      .patch(`/api/recipes/${v1Id}`)
      .send({
        title: 'Changed Eggs',
        ingredients: [
          { name: 'eggs', amount: 2, unit: 'large', isOptional: false, orderIndex: 0, internalId: 'eggs_1' },
        ],
      });

    // Restore v1 (should create v3 with v1's data)
    const restoreRes = await request(app).post(`/api/recipes/${v1Id}/restore/1`);

    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.version).toBe(3);
    expect(restoreRes.body.title).toBe('Scrambled Eggs');
    expect(restoreRes.body.isLatest).toBe(true);
    expect(restoreRes.body.ingredients).toHaveLength(4);

    // Verify old v2 is no longer latest
    const v2 = await request(app).get(`/api/recipes/${updateRes.body.id}`);
    expect(v2.body.isLatest).toBe(false);
  });

  it('returns 404 for non-existent version', async () => {
    const createRes = await request(app).post('/api/recipes').send(sampleRecipe);
    const res = await request(app).post(`/api/recipes/${createRes.body.id}/restore/99`);

    expect(res.status).toBe(404);
  });
});
