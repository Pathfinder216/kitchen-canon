import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../db.js';
import { createAuthedApi, cleanupUsers, type AuthedApi } from './helpers/auth.js';

const app = createApp();
let api: AuthedApi;

beforeEach(async () => {
  await cleanupUsers(); // cascades UserPreferences
  api = await createAuthedApi(app);
});

afterAll(cleanupUsers);

describe('GET /api/preferences', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/preferences');
    expect(res.status).toBe(401);
  });

  it('get-or-creates the row with defaults on first read', async () => {
    expect(await prisma.userPreferences.count({ where: { userId: api.userId } })).toBe(0);
    const res = await api.get('/api/preferences');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unitSystem: 'original', locale: 'en-US', theme: 'light' });
    expect(await prisma.userPreferences.count({ where: { userId: api.userId } })).toBe(1);

    // A second read reuses the row rather than creating another.
    await api.get('/api/preferences').expect(200);
    expect(await prisma.userPreferences.count({ where: { userId: api.userId } })).toBe(1);
  });
});

describe('PATCH /api/preferences', () => {
  it('requires authentication', async () => {
    const res = await request(app).patch('/api/preferences').send({ unitSystem: 'metric' });
    // CSRF runs before requireAuth, so an anonymous mutation is rejected by one of the two gates.
    expect([401, 403]).toContain(res.status);
  });

  it('updates unitSystem and persists it', async () => {
    const res = await api.patch('/api/preferences').send({ unitSystem: 'metric' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unitSystem: 'metric', locale: 'en-US', theme: 'light' });

    const again = await api.get('/api/preferences');
    expect(again.body.unitSystem).toBe('metric');
  });

  it('is a partial update — omitted fields keep their values', async () => {
    await api.patch('/api/preferences').send({ unitSystem: 'imperial' }).expect(200);
    const res = await api.patch('/api/preferences').send({ locale: 'en-GB' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unitSystem: 'imperial', locale: 'en-GB', theme: 'light' });
  });

  it('rejects an unknown unit system', async () => {
    const res = await api.patch('/api/preferences').send({ unitSystem: 'furlongs' });
    expect(res.status).toBe(400);
  });

  it('rejects unknown fields and invalid themes', async () => {
    expect((await api.patch('/api/preferences').send({ bogus: true })).status).toBe(400);
    expect((await api.patch('/api/preferences').send({ theme: 'neon' })).status).toBe(400);
  });

  it("isolates users — one user's preference never affects another's", async () => {
    const other = await createAuthedApi(app);
    await api.patch('/api/preferences').send({ unitSystem: 'metric' }).expect(200);

    const otherRes = await other.get('/api/preferences');
    expect(otherRes.body.unitSystem).toBe('original');

    await other.patch('/api/preferences').send({ unitSystem: 'imperial' }).expect(200);
    expect((await api.get('/api/preferences')).body.unitSystem).toBe('metric');
  });

  it('never alters stored recipe units (conversion is display-only)', async () => {
    await api.patch('/api/preferences').send({ unitSystem: 'metric' }).expect(200);
    const created = await api.post('/api/recipes').send({
      title: 'Pancakes',
      servings: 2,
      ingredients: [{ name: 'flour', amount: 0.5, unit: 'cup', orderIndex: 0 }],
      steps: [{ instruction: 'Heat oven to 400°F', orderIndex: 0 }],
    });
    expect(created.status).toBe(201);
    const res = await api.get(`/api/recipes/${created.body.id}`);
    expect(res.body.ingredients[0]).toMatchObject({ amount: 0.5, unit: 'cup' });
    expect(res.body.steps[0].instruction).toBe('Heat oven to 400°F');
  });
});
