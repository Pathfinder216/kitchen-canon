import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createAuthedApi, cleanupUsers, type AuthedApi } from './helpers/auth.js';

const app = createApp();
let api: AuthedApi;

beforeEach(async () => {
  await cleanupUsers();
  api = await createAuthedApi(app);
});

afterAll(cleanupUsers);

describe('GET /api/meta', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/meta');
    expect(res.status).toBe(401);
  });

  it('returns the dietary vocabulary with allergens, diets, and label maps', async () => {
    const res = await api.get('/api/meta');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      allergens: expect.any(Array),
      diets: expect.any(Array),
      allergenLabels: expect.any(Object),
      dietLabels: expect.any(Object),
    });
    expect(res.body.allergens).toContain('dairy');
    expect(res.body.diets).toContain('vegan');
    expect(res.body.allergenLabels.dairy).toBe('Dairy');
    expect(res.body.dietLabels.vegan).toBe('Vegan');
  });
});
