import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from '../app.js';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { createAuthedApi, cleanupUsers, type AuthedApi } from './helpers/auth.js';
import {
  FDC_BASE_URL,
  normalizeFood,
  normalizeNutrients,
  normalizePortions,
  resetFdcThrottle,
} from '../services/nutrition.service.js';

// Recorded USDA FoodData Central responses (captured 2026-09 with the public DEMO_KEY):
// - fdc-search.json: POST /foods/search {query:"greek yogurt", dataType:[Foundation, SR Legacy], pageSize:5}
// - fdc/food-171265.json: GET /food/171265?nutrients=… (SR Legacy whole milk — cup/tbsp/fl oz/quart portions)
// - fdc/food-330137.json: GET /food/330137?nutrients=… (Foundation nonfat Greek yogurt — container + RACC portions)
// Tests never hit the network: global fetch is mocked to replay these.
const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const readFixture = (rel: string) => JSON.parse(readFileSync(path.join(fixturesDir, rel), 'utf-8'));
const searchFixture = readFixture('fdc-search.json');
const milkFixture = readFixture('fdc/food-171265.json');
const foundationYogurtFixture = readFixture('fdc/food-330137.json');

const app = createApp();
let api: AuthedApi;
let fetchSpy: ReturnType<typeof vi.spyOn>;
const originalKey = config.FDC_API_KEY;

/** Make the mocked upstream answer every call with `body` (a fresh Response each time). */
function mockFdc(body: unknown, status = 200) {
  fetchSpy.mockImplementation(async () => new Response(JSON.stringify(body), { status }));
}

beforeEach(async () => {
  await cleanupUsers();
  await prisma.ingredientCatalog.deleteMany();
  api = await createAuthedApi(app);
  config.FDC_API_KEY = 'test-fdc-key';
  resetFdcThrottle(0);
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    throw new Error('Unexpected network call — mock the FDC response for this test');
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
  config.FDC_API_KEY = originalKey;
  resetFdcThrottle();
});

describe('FDC normalization (recorded fixtures)', () => {
  it('maps SR Legacy search nutrients to the per-100 g storage shape', () => {
    const food = searchFixture.foods.find((f: { fdcId: number }) => f.fdcId === 170903);
    const match = normalizeFood(food);
    expect(match).toMatchObject({
      fdcId: 170903,
      description: 'Yogurt, Greek, plain, lowfat',
      dataType: 'SR Legacy',
      foodCategory: 'Dairy and Egg Products',
    });
    expect(match.nutrition).toEqual({
      per100g: {
        calories: 73,
        protein: 9.95,
        fat: 1.92,
        saturatedFat: 1.23,
        carbs: 3.94,
        fiber: 0,
        sugar: 3.56,
        sodium: 34,
      },
      source: 'fdc',
      fdcId: 170903,
      fdcDescription: 'Yogurt, Greek, plain, lowfat',
    });
  });

  it('falls back to Foundation-style nutrient ids (sugar 1063) and omits what FDC lacks', () => {
    const food = searchFixture.foods.find((f: { fdcId: number }) => f.fdcId === 330137);
    expect(normalizeFood(food).nutrition.per100g).toEqual({
      calories: 61,
      protein: 10.3,
      fat: 0.37,
      saturatedFat: 0.108,
      carbs: 3.64,
      sugar: 3.27,
      sodium: 36,
    });
  });

  it('derives kcal from Atwater or kJ when the plain energy row is missing', () => {
    expect(normalizeNutrients([{ nutrientId: 2047, value: 120 }]).calories).toBe(120);
    expect(normalizeNutrients([{ nutrientId: 1062, value: 418.4 }]).calories).toBe(100);
    expect(normalizeNutrients([{ nutrient: { id: 1008 }, amount: 50 }, { nutrientId: 1062, value: 999 }]).calories).toBe(50);
  });

  it('turns SR Legacy portions into canonical-unit grams (detail fixture)', () => {
    const match = normalizeFood(milkFixture);
    expect(match.nutrition.gramsPerUnit).toEqual({ cup: 244, 'fl oz': 30.5, tbsp: 15, qt: 976 });
    expect(match.nutrition.per100g.calories).toBe(61);
    expect(match.nutrition.per100g.sodium).toBe(43);
  });

  it('keeps Foundation measure units and skips RACC serving sizes', () => {
    expect(normalizeFood(foundationYogurtFixture).nutrition.gramsPerUnit).toEqual({ container: 156 });
  });

  it('divides by the portion amount and ignores unusable portions', () => {
    expect(
      normalizePortions([
        { gramWeight: 30, amount: 2, modifier: 'tablespoons, chopped', measureUnit: { name: 'undetermined' } },
        { gramWeight: 0, amount: 1, modifier: 'cup', measureUnit: { name: 'undetermined' } },
        { gramWeight: 5, amount: 1, modifier: 'Quantity not specified', measureUnit: { name: 'undetermined' } },
      ]),
    ).toEqual({ tbsp: 15 });
    expect(normalizePortions([])).toBeUndefined();
  });
});

describe('GET /api/nutrition/status', () => {
  it('reports whether the lookup is configured', async () => {
    expect((await api.get('/api/nutrition/status')).body).toEqual({ lookupConfigured: true });
    config.FDC_API_KEY = undefined;
    expect((await api.get('/api/nutrition/status')).body).toEqual({ lookupConfigured: false });
  });

  it('requires a session', async () => {
    expect((await request(app).get('/api/nutrition/status')).status).toBe(401);
  });
});

describe('GET /api/nutrition/search', () => {
  it('proxies FDC and returns the top 5 normalized matches', async () => {
    mockFdc(searchFixture);
    const res = await api.get('/api/nutrition/search?q=greek%20yogurt');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    expect(res.body.map((m: { fdcId: number }) => m.fdcId)).toEqual([170914, 170903, 330137, 171300, 330415]);
    expect(res.body[1].nutrition.per100g.calories).toBe(73);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${FDC_BASE_URL}/foods/search`);
    expect(url).not.toContain('test-fdc-key'); // key travels in a header, never the URL
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe('test-fdc-key');
    expect(JSON.parse(init.body as string)).toEqual({
      query: 'greek yogurt',
      dataType: ['Foundation', 'SR Legacy'],
      pageSize: 5,
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns 503 without calling FDC when no key is configured', async () => {
    config.FDC_API_KEY = undefined;
    const res = await api.get('/api/nutrition/search?q=yogurt');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a missing or overlong query', async () => {
    expect((await api.get('/api/nutrition/search')).status).toBe(400);
    expect((await api.get('/api/nutrition/search?q=%20%20')).status).toBe(400);
    expect((await api.get(`/api/nutrition/search?q=${'a'.repeat(101)}`)).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps upstream failures to a readable 502', async () => {
    mockFdc({ error: 'boom' }, 500);
    let res = await api.get('/api/nutrition/search?q=yogurt');
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/HTTP 500/);

    mockFdc({ error: { code: 'OVER_RATE_LIMIT' } }, 429);
    res = await api.get('/api/nutrition/search?q=yogurt');
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/rate limit/i);

    fetchSpy.mockImplementation(async () => {
      throw new TypeError('fetch failed');
    });
    res = await api.get('/api/nutrition/search?q=yogurt');
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/could not reach/i);
    expect(res.body.error).not.toContain('test-fdc-key');
  });

  it('maps a timeout to a 502', async () => {
    fetchSpy.mockImplementation(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
    const res = await api.get('/api/nutrition/search?q=yogurt');
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/did not respond in time/i);
  });

  it('spaces upstream calls by the throttle interval', async () => {
    resetFdcThrottle(150);
    const callTimes: number[] = [];
    fetchSpy.mockImplementation(async () => {
      callTimes.push(Date.now());
      return new Response(JSON.stringify({ foods: [] }), { status: 200 });
    });
    await Promise.all([api.get('/api/nutrition/search?q=a'), api.get('/api/nutrition/search?q=b')]);
    expect(callTimes).toHaveLength(2);
    expect(Math.abs(callTimes[1] - callTimes[0])).toBeGreaterThanOrEqual(140);
  });
});

describe('GET /api/nutrition/food/:fdcId', () => {
  it('fetches one food with its portions', async () => {
    mockFdc(milkFixture);
    const res = await api.get('/api/nutrition/food/171265');
    expect(res.status).toBe(200);
    expect(res.body.nutrition).toMatchObject({
      source: 'fdc',
      fdcId: 171265,
      gramsPerUnit: { cup: 244, tbsp: 15 },
    });
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url.startsWith(`${FDC_BASE_URL}/food/171265?nutrients=`)).toBe(true);
  });

  it('validates the id and passes through a 404', async () => {
    expect((await api.get('/api/nutrition/food/abc')).status).toBe(400);
    expect((await api.get('/api/nutrition/food/0')).status).toBe(400);
    mockFdc({}, 404);
    expect((await api.get('/api/nutrition/food/999999999')).status).toBe(404);
  });
});

describe('catalog nutrition round-trip', () => {
  const fdcNutrition = normalizeFood(milkFixture).nutrition;

  it('POST stores nutrition and GET returns it', async () => {
    const created = await api.post('/api/ingredients').send({
      name: 'whole milk',
      allergens: ['dairy'],
      diets: ['vegetarian'],
      nutrition: fdcNutrition,
    });
    expect(created.status).toBe(201);
    expect(created.body.nutrition).toEqual(fdcNutrition);

    const list = await api.get('/api/ingredients?q=whole%20milk');
    expect(list.body[0].nutrition).toEqual(fdcNutrition);
  });

  it('PATCH sets, keeps (omitted), and clears (null) nutrition', async () => {
    const created = await api.post('/api/ingredients').send({ name: 'oat milk', allergens: [], diets: ['vegan'] });
    expect(created.body.nutrition).toBeNull();
    const id = created.body.id;

    const manual = { per100g: { calories: 46, protein: 1 }, source: 'manual' };
    let res = await api.patch(`/api/ingredients/${id}`).send({ allergens: [], diets: ['vegan'], nutrition: manual });
    expect(res.status).toBe(200);
    expect(res.body.nutrition).toEqual(manual);

    res = await api.patch(`/api/ingredients/${id}`).send({ allergens: [], diets: ['vegan', 'vegetarian'] });
    expect(res.body.nutrition).toEqual(manual);

    res = await api.patch(`/api/ingredients/${id}`).send({ allergens: [], diets: ['vegan'], nutrition: null });
    expect(res.body.nutrition).toBeNull();
    const row = await prisma.ingredientCatalog.findUniqueOrThrow({ where: { id } });
    expect(row.nutrition).toBeNull();
  });

  it('rejects invalid nutrition', async () => {
    const created = await api.post('/api/ingredients').send({ name: 'rice', allergens: [], diets: [] });
    const id = created.body.id;
    const bad = [
      { per100g: { calories: -1 }, source: 'manual' },
      { per100g: { vitaminC: 5 }, source: 'manual' },
      { per100g: {}, source: 'guess' },
      { per100g: {}, source: 'fdc', gramsPerUnit: { cup: 0 } },
    ];
    for (const nutrition of bad) {
      const res = await api.patch(`/api/ingredients/${id}`).send({ allergens: [], diets: [], nutrition });
      expect(res.status).toBe(400);
    }
  });

  it('keeps built-ins read-only: nutrition on a global goes onto a private shadow', async () => {
    const global = await prisma.ingredientCatalog.create({
      data: { displayAlias: 'butter', allergens: ['dairy'], diets: ['vegetarian'], nutrition: fdcNutrition },
    });
    await prisma.ingredientAlias.create({ data: { alias: 'butter', catalogId: global.id } });

    // PATCH on a global is a 404 (not the user's row).
    const patch = await api.patch(`/api/ingredients/${global.id}`).send({ allergens: [], diets: [], nutrition: null });
    expect(patch.status).toBe(404);

    // Customizing only the tags inherits the built-in's nutrition…
    const shadow = await api.post('/api/ingredients').send({ name: 'butter', allergens: ['dairy'], diets: [] });
    expect(shadow.status).toBe(201);
    expect(shadow.body.nutrition).toEqual(fdcNutrition);

    // …and an explicit value wins, leaving the global untouched.
    const copied = { ...fdcNutrition, source: 'copied' };
    const updated = await api.post('/api/ingredients').send({ name: 'butter', allergens: ['dairy'], diets: [], nutrition: copied });
    expect(updated.body.id).toBe(shadow.body.id);
    expect(updated.body.nutrition).toEqual(copied);
    const unchanged = await prisma.ingredientCatalog.findUniqueOrThrow({ where: { id: global.id } });
    expect(unchanged.nutrition).toEqual(fdcNutrition);
  });

  it('suggest returns nutrition so copy-from-similar can prefill it', async () => {
    await api.post('/api/ingredients').send({ name: 'chicken breast', allergens: [], diets: [], nutrition: fdcNutrition });
    const res = await api.get('/api/ingredients/suggest?name=chiken%20breast');
    expect(res.status).toBe(200);
    expect(res.body[0].displayAlias).toBe('chicken breast');
    expect(res.body[0].nutrition).toEqual(fdcNutrition);
  });
});
