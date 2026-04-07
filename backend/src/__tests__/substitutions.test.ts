import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

const app = createApp();

beforeEach(async () => {
  const { prisma } = await import('../db.js');
  await prisma.ingredientSubstitution.deleteMany();
});

describe('Substitutions API', () => {
  it('creates a substitution', async () => {
    const res = await request(app).post('/api/substitutions').send({
      fromIngredient: 'butter',
      toIngredient: 'coconut oil',
      ratio: 0.8,
      notes: 'Use slightly less',
    });
    expect(res.status).toBe(201);
    expect(res.body.fromIngredient).toBe('butter');
    expect(res.body.toIngredient).toBe('coconut oil');
    expect(res.body.ratio).toBeCloseTo(0.8);
  });

  it('lists all substitutions', async () => {
    await request(app).post('/api/substitutions').send({ fromIngredient: 'butter', toIngredient: 'margarine', ratio: 1 });
    await request(app).post('/api/substitutions').send({ fromIngredient: 'milk', toIngredient: 'oat milk', ratio: 1 });
    const res = await request(app).get('/api/substitutions');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('filters by fromIngredient', async () => {
    await request(app).post('/api/substitutions').send({ fromIngredient: 'butter', toIngredient: 'margarine', ratio: 1 });
    await request(app).post('/api/substitutions').send({ fromIngredient: 'milk', toIngredient: 'oat milk', ratio: 1 });
    const res = await request(app).get('/api/substitutions?from=butter');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].toIngredient).toBe('margarine');
  });

  it('deletes a substitution', async () => {
    const create = await request(app).post('/api/substitutions').send({ fromIngredient: 'eggs', toIngredient: 'flax egg', ratio: 1 });
    const id = create.body.id;
    const del = await request(app).delete(`/api/substitutions/${id}`);
    expect(del.status).toBe(204);
    const list = await request(app).get('/api/substitutions');
    expect(list.body.length).toBe(0);
  });

  it('returns 404 for deleting non-existent substitution', async () => {
    const res = await request(app).delete('/api/substitutions/nonexistent');
    expect(res.status).toBe(404);
  });

  it('gets substitutions for a recipe', async () => {
    // Create a recipe with butter
    const recipe = await request(app).post('/api/recipes').send({
      title: 'Butter Cake',
      servings: 4,
      ingredients: [
        { name: 'butter', amount: 0.5, unit: 'cup', orderIndex: 0 },
        { name: 'sugar', amount: 1, unit: 'cup', orderIndex: 1 },
      ],
    });
    await request(app).post('/api/substitutions').send({ fromIngredient: 'butter', toIngredient: 'coconut oil', ratio: 0.8 });
    await request(app).post('/api/substitutions').send({ fromIngredient: 'flour', toIngredient: 'almond flour', ratio: 1 });

    const res = await request(app).get(`/api/recipes/${recipe.body.id}/substitutions`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1); // only butter (not flour, which isn't in the recipe)
    expect(res.body[0].toIngredient).toBe('coconut oil');
  });
});
