import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { prisma } from '../db.js';
import { createAuthedApi, cleanupUsers, type AuthedApi } from './helpers/auth.js';

const app = createApp();
let api: AuthedApi;

const ALL_DIETS = ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'nut_free', 'pescatarian'];

/** Seed a global catalog entry (userId null) with its display name and extra aliases. */
async function seedGlobal(displayAlias: string, opts: { allergens?: string[]; diets?: string[]; aliases?: string[] } = {}) {
  const entry = await prisma.ingredientCatalog.create({
    data: { displayAlias, allergens: opts.allergens ?? [], diets: opts.diets ?? ALL_DIETS, isUserAdded: false },
  });
  for (const alias of new Set([displayAlias, ...(opts.aliases ?? [])])) {
    await prisma.ingredientAlias.create({ data: { alias, catalogId: entry.id } });
  }
  return entry;
}

async function seedCatalog() {
  return {
    tomatoes: await seedGlobal('tomatoes', { aliases: ['tomato'] }),
    cherryTomatoes: await seedGlobal('cherry tomatoes', { aliases: ['cherry tomato'] }),
    chicken: await seedGlobal('chicken', { diets: ['gluten_free', 'dairy_free', 'nut_free'] }),
    chickenBreast: await seedGlobal('chicken breast', { diets: ['gluten_free', 'dairy_free', 'nut_free'] }),
    broccoli: await seedGlobal('broccoli'),
    salt: await seedGlobal('salt'),
    milk: await seedGlobal('milk', { allergens: ['dairy'], diets: ['vegetarian', 'gluten_free', 'nut_free'] }),
  };
}

function createRecipe(title: string, ingredientNames: string[]) {
  return api.post('/api/recipes').send({
    title,
    ingredients: ingredientNames.map((name, orderIndex) => ({ name, orderIndex })),
    steps: [{ orderIndex: 0, instruction: 'Cook.' }],
  });
}

const titles = (res: { body: { recipes: { title: string }[] } }) => res.body.recipes.map((r) => r.title).sort();

beforeEach(async () => {
  await cleanupUsers();
  await prisma.label.deleteMany();
  await prisma.ingredientCatalog.deleteMany();
  api = await createAuthedApi(app);
});

describe('GET /api/ingredients?q= typeahead', () => {
  it('appends fuzzy matches for a typo, best first', async () => {
    await seedCatalog();
    const res = await api.get('/api/ingredients?q=tomatos');
    expect(res.status).toBe(200);
    const names = res.body.map((e: { displayAlias: string }) => e.displayAlias);
    expect(names[0]).toBe('tomatoes');
    expect(names).toContain('cherry tomatoes');
    expect(names).not.toContain('salt');
    // Return shape is unchanged: full catalog entries with aliases.
    expect(res.body[0]).toHaveProperty('aliases');
  });

  it('keeps substring hits first and does not duplicate them', async () => {
    await seedCatalog();
    const res = await api.get('/api/ingredients?q=chicken');
    const names = res.body.map((e: { displayAlias: string }) => e.displayAlias);
    expect(names).toEqual(['chicken', 'chicken breast']);
  });

  it('does not fuzzy-match very short queries', async () => {
    await seedCatalog();
    const res = await api.get('/api/ingredients?q=zz');
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/ingredients/suggest', () => {
  it('returns the top-3 matches for a misspelling, best first', async () => {
    const { chicken } = await seedCatalog();
    const res = await api.get('/api/ingredients/suggest?name=chiken');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.length).toBeLessThanOrEqual(3);
    expect(res.body[0]).toEqual({
      id: chicken.id,
      displayAlias: 'chicken',
      allergens: [],
      diets: ['gluten_free', 'dairy_free', 'nut_free'],
      aisle: null,
      nutrition: null,
      score: expect.any(Number),
    });
    const scores = res.body.map((s: { score: number }) => s.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('suggests the obvious entry for other food typos', async () => {
    await seedCatalog();
    const brocolli = await api.get('/api/ingredients/suggest?name=brocolli');
    expect(brocolli.body[0].displayAlias).toBe('broccoli');
    const tomatos = await api.get('/api/ingredients/suggest?name=Tomatos');
    expect(tomatos.body[0].displayAlias).toBe('tomatoes');
  });

  it("prefers the user's own entry over the built-in it shadows", async () => {
    await seedCatalog();
    const own = await api.post('/api/ingredients').send({ name: 'chicken', allergens: [], diets: [] });
    const res = await api.get('/api/ingredients/suggest?name=chiken');
    expect(res.body[0].id).toBe(own.body.id);
    expect(res.body.filter((s: { displayAlias: string }) => s.displayAlias === 'chicken')).toHaveLength(1);
  });

  it('returns nothing for unrelated names and 400 without a name', async () => {
    await seedCatalog();
    expect((await api.get('/api/ingredients/suggest?name=xylophone')).body).toEqual([]);
    expect((await api.get('/api/ingredients/suggest')).status).toBe(400);
  });

  it("does not suggest another user's private entries", async () => {
    const other = await createAuthedApi(app);
    await other.post('/api/ingredients').send({ name: 'secret sauce', allergens: [], diets: [] });
    expect((await api.get('/api/ingredients/suggest?name=secret sause')).body).toEqual([]);
  });
});

describe('recipe list ingredient filters', () => {
  async function seedRecipes() {
    await seedCatalog();
    await createRecipe('Tomato Salad', ['tomatoes', 'salt']);
    await createRecipe('Cherry Snack', ['cherry tomatoes']);
    await createRecipe('Broccoli Bake', ['broccoli', 'milk']);
  }

  it('resolves a misspelled include term to the closest catalog entry', async () => {
    await seedRecipes();
    const res = await api.get('/api/recipes?includeIngredients=tomatos');
    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(['Tomato Salad']);

    const brocolli = await api.get('/api/recipes?includeIngredients=brocolli');
    expect(titles(brocolli)).toEqual(['Broccoli Bake']);
  });

  it('resolves a misspelled exclude term to the closest catalog entry', async () => {
    await seedRecipes();
    const res = await api.get('/api/recipes?excludeIngredients=brocolli');
    expect(titles(res)).toEqual(['Cherry Snack', 'Tomato Salad']);

    // "tomatos" → "tomatoes" via fuzzy; the raw-substring branch ("tomato") also drops the
    // cherry tomatoes recipe — exclusion errs on the side of excluding more.
    const tomatos = await api.get('/api/recipes?excludeIngredients=tomatos');
    expect(titles(tomatos)).toEqual(['Broccoli Bake']);
  });

  it('keeps exclusion aggressive via raw substring matching', async () => {
    await seedCatalog();
    await createRecipe('Walnut Cake', ['walnuts']);
    await createRecipe('Pesto', ['pine nuts']);
    await createRecipe('Plain Rice', ['rice']);
    const res = await api.get('/api/recipes?excludeIngredients=nuts');
    expect(titles(res)).toEqual(['Plain Rice']);
  });

  it('still includes by raw name for terms not in the catalog', async () => {
    await seedCatalog();
    await createRecipe('Walnut Cake', ['walnuts']);
    await createRecipe('Plain Rice', ['rice']);
    const res = await api.get('/api/recipes?includeIngredients=walnut');
    expect(titles(res)).toEqual(['Walnut Cake']);
  });

  it('matches nothing when a term is neither in the catalog nor fuzzy-close', async () => {
    await seedRecipes();
    const res = await api.get('/api/recipes?includeIngredients=xylophone');
    expect(res.body.recipes).toEqual([]);
  });
});

describe('recipe title search', () => {
  beforeEach(async () => {
    await createRecipe('Chicken Soup', []);
    await createRecipe("Grandma's Lasagna", []);
    await createRecipe('Pancakes', []);
  });

  it('uses substring matching when it finds something', async () => {
    const res = await api.get('/api/recipes?search=soup');
    expect(titles(res)).toEqual(['Chicken Soup']);
  });

  it('falls back to fuzzy title matching when substring search finds nothing', async () => {
    expect(titles(await api.get('/api/recipes?search=chiken%20soup'))).toEqual(['Chicken Soup']);
    const lasagne = await api.get('/api/recipes?search=lasagne');
    expect(titles(lasagne)).toEqual(["Grandma's Lasagna"]);
    expect(lasagne.body.pagination.total).toBe(1);
  });

  it('returns nothing when neither substring nor fuzzy matching hits', async () => {
    const res = await api.get('/api/recipes?search=xylophone');
    expect(res.body.recipes).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it("never fuzzy-matches another user's recipes", async () => {
    const other = await createAuthedApi(app);
    const res = await other.get('/api/recipes?search=chiken%20soup');
    expect(res.body.recipes).toEqual([]);
  });
});

describe('dietary auto-detection ignores fuzzy matches', () => {
  it('leaves a misspelled ingredient unclassified and unlinked until the user confirms', async () => {
    await seedCatalog();
    const recipe = await createRecipe('Chiken Dinner', ['chiken', 'brocolli']);
    expect(recipe.status).toBe(201);
    expect(recipe.body.ingredients.every((i: { catalogId: string | null }) => i.catalogId === null)).toBe(true);
    // One unknown ingredient means no diet labels are claimed.
    const autoLabels = recipe.body.labels.filter((rl: { label: { type: string } }) => rl.label.type !== 'manual');
    expect(autoLabels).toEqual([]);

    const info = await api.get(`/api/recipes/${recipe.body.id}/dietary-info`);
    expect(info.body.unknownIngredients.sort()).toEqual(['brocolli', 'chiken']);
    expect(info.body.diets).toEqual([]);
    expect(info.body.allergens).toEqual([]);

    // The suggestion endpoint offers the fix but changes nothing by itself.
    const suggest = await api.get('/api/ingredients/suggest?name=chiken');
    expect(suggest.body[0].displayAlias).toBe('chicken');
    const after = await api.get(`/api/recipes/${recipe.body.id}/dietary-info`);
    expect(after.body.unknownIngredients.sort()).toEqual(['brocolli', 'chiken']);
  });

  it('does not detect allergens through a fuzzy match (milck ≠ milk)', async () => {
    await seedCatalog();
    const recipe = await createRecipe('Latte', ['milck']);
    const info = await api.get(`/api/recipes/${recipe.body.id}/dietary-info`);
    expect(info.body.allergens).toEqual([]);
    expect(info.body.unknownIngredients).toEqual(['milck']);
  });
});
