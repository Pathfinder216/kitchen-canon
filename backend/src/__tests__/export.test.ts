import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

const app = createApp();

const sampleRecipe = {
  title: 'Test Cake',
  servings: 8,
  totalTime: 60,
  authorNotes: 'A classic cake',
  ingredients: [
    { name: 'flour', amount: 2, unit: 'cups', orderIndex: 0, internalId: 'i1', isOptional: false },
    { name: 'sugar', amount: 1, unit: 'cup', orderIndex: 1, internalId: 'i2', isOptional: false },
  ],
  steps: [
    { orderIndex: 0, instruction: 'Mix ingredients', timeMinutes: 5 },
    { orderIndex: 1, instruction: 'Bake at 350°F', timeMinutes: 45 },
  ],
};

let recipeId: string;

beforeEach(async () => {
  const res = await request(app).post('/api/recipes').send(sampleRecipe);
  recipeId = res.body.id;
});

describe('GET /api/recipes/:id/export', () => {
  it('exports recipe as JSON by default', async () => {
    const res = await request(app).get(`/api/recipes/${recipeId}/export`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    const body = JSON.parse(res.text);
    expect(body.title).toBe('Test Cake');
    expect(body.ingredients).toHaveLength(2);
    expect(body.steps).toHaveLength(2);
    expect(body.exportedAt).toBeDefined();
  });

  it('exports recipe as plain text', async () => {
    const res = await request(app).get(`/api/recipes/${recipeId}/export?format=text`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('Test Cake');
    expect(res.text).toContain('flour');
    expect(res.text).toContain('Mix ingredients');
  });

  it('text export contains serving info', async () => {
    const res = await request(app).get(`/api/recipes/${recipeId}/export?format=text`);
    expect(res.text).toContain('Serves: 8');
  });

  it('text export numbers steps', async () => {
    const res = await request(app).get(`/api/recipes/${recipeId}/export?format=text`);
    expect(res.text).toContain('1. Mix ingredients');
    expect(res.text).toContain('2. Bake at 350°F');
  });

  it('returns 404 for unknown recipe', async () => {
    const res = await request(app).get('/api/recipes/nonexistent/export');
    expect(res.status).toBe(404);
  });
});
