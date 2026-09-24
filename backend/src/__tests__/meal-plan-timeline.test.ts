import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { createAuthedApi, cleanupUsers, type AuthedApi } from './helpers/auth.js';

const app = createApp();
let api: AuthedApi;
let roastId: string;
let saladId: string;
let planId: string;

const SERVE_AT = '2026-03-14T18:00:00.000Z';
const MIN = 60_000;

beforeEach(async () => {
  await cleanupUsers();
  api = await createAuthedApi(app);

  const roast = await api.post('/api/recipes').send({
    title: 'Roast chicken',
    servings: 4,
    ingredients: [{ name: 'chicken', amount: 1, unit: 'whole', orderIndex: 0 }],
    steps: [
      { orderIndex: 0, instruction: 'Season the {chicken}.', timeMinutes: 15, isActiveTime: true },
      { orderIndex: 1, instruction: 'Roast.', timeMinutes: 90, isActiveTime: false },
      { orderIndex: 2, instruction: 'Carve.', timeMinutes: 10, isActiveTime: true },
    ],
  });
  roastId = roast.body.id;

  const salad = await api.post('/api/recipes').send({
    title: 'Green salad',
    servings: 2,
    ingredients: [{ name: 'lettuce', amount: 1, unit: 'head', orderIndex: 0 }],
    steps: [
      { orderIndex: 0, instruction: 'Chop.', timeMinutes: 10, isActiveTime: true },
      { orderIndex: 1, instruction: 'Dress.', isActiveTime: true },
    ],
  });
  saladId = salad.body.id;

  const plan = await api.post('/api/meal-plans').send({
    name: 'Sunday dinner',
    recipes: [
      { recipeId: saladId, servings: 2 },
      { recipeId: roastId, servings: 4 },
    ],
  });
  planId = plan.body.id;
});

describe('GET /api/meal-plans/:id/timeline', () => {
  it('returns a schedule ending at serveAt with no overlapping active steps', async () => {
    const res = await api.get(`/api/meal-plans/${planId}/timeline?serveAt=${encodeURIComponent(SERVE_AT)}`);

    expect(res.status).toBe(200);
    expect(res.body.serveAt).toBe(SERVE_AT);
    expect(res.body.entries).toHaveLength(5);
    expect(res.body.recipes.map((r: { recipeId: string }) => r.recipeId)).toEqual([saladId, roastId]);

    const roastEntries = res.body.entries.filter((e: { recipeId: string }) => e.recipeId === roastId);
    expect(roastEntries[0]).toMatchObject({ label: 'Season the chicken.', isActive: true });
    expect(roastEntries[0].start).toBe(new Date(Date.parse(SERVE_AT) - 115 * MIN).toISOString());
    expect(roastEntries[2].end).toBe(SERVE_AT);

    const active = res.body.entries.filter((e: { isActive: boolean }) => e.isActive);
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const [a, b] = [active[i], active[j]];
        expect(Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end)).toBe(false);
      }
    }

    // The salad's untimed "Dress" step got the 5-minute default and a warning.
    expect(res.body.warnings).toEqual([
      expect.objectContaining({ type: 'untimed-steps', recipeId: saladId }),
    ]);
    expect(res.body.makeAhead).toEqual([]);
  });

  it('uses the recipe version pinned by the plan, not a later edit', async () => {
    const edit = await api.patch(`/api/recipes/${roastId}`).send({
      steps: [{ orderIndex: 0, instruction: 'Microwave.', timeMinutes: 3, isActiveTime: true }],
    });
    expect(edit.status).toBe(200);
    expect(edit.body.id).not.toBe(roastId);

    const res = await api.get(`/api/meal-plans/${planId}/timeline?serveAt=${encodeURIComponent(SERVE_AT)}`);
    expect(res.status).toBe(200);
    const labels = res.body.entries
      .filter((e: { recipeId: string }) => e.recipeId === roastId)
      .map((e: { label: string }) => e.label);
    expect(labels).toEqual(['Season the chicken.', 'Roast.', 'Carve.']);
  });

  it('accepts a serve time in the past (preview)', async () => {
    const res = await api.get(`/api/meal-plans/${planId}/timeline?serveAt=2001-01-01T12:00:00Z`);
    expect(res.status).toBe(200);
    expect(res.body.serveAt).toBe('2001-01-01T12:00:00.000Z');
  });

  it('rejects a missing or unparseable serveAt', async () => {
    expect((await api.get(`/api/meal-plans/${planId}/timeline`)).status).toBe(400);
    expect((await api.get(`/api/meal-plans/${planId}/timeline?serveAt=not-a-date`)).status).toBe(400);
  });

  it('returns 404 for an unknown plan', async () => {
    const res = await api.get(`/api/meal-plans/does-not-exist/timeline?serveAt=${encodeURIComponent(SERVE_AT)}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for another user's plan", async () => {
    const other = await createAuthedApi(app);
    const res = await other.get(`/api/meal-plans/${planId}/timeline?serveAt=${encodeURIComponent(SERVE_AT)}`);
    expect(res.status).toBe(404);
  });
});
