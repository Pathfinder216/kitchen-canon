import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createApp } from '../app.js';
import { prisma } from '../db.js';
import { AISLES } from '../constants/aisles.js';
import { INGREDIENT_CATALOG } from '../constants/ingredientCatalog.js';
import { createAuthedApi, cleanupUsers, type AuthedApi } from './helpers/auth.js';

const app = createApp();
let api: AuthedApi;
let recipeId: string;

/** Seed a global catalog entry (userId null) using its aisle from the real seed constant. */
async function seedGlobal(name: string) {
  const row = INGREDIENT_CATALOG.find(([n]) => n === name);
  if (!row) throw new Error(`${name} not in INGREDIENT_CATALOG`);
  const [, allergens, diets, aisle] = row;
  const entry = await prisma.ingredientCatalog.create({
    data: { displayAlias: name, allergens, diets, aisle, isUserAdded: false },
  });
  await prisma.ingredientAlias.create({ data: { alias: name, catalogId: entry.id } });
  return entry;
}

type Item = { ingredient: string; aisle: string };
const aisleOf = (list: Item[], name: string) => list.find((i) => i.ingredient === name)?.aisle;

async function createPlan(client: AuthedApi, rid: string) {
  const res = await client.post('/api/meal-plans').send({ name: 'Dinner', recipes: [{ recipeId: rid, servings: 2 }] });
  expect(res.status).toBe(201);
  return res.body as { id: string; groceryList: Item[] };
}

async function createRecipe(client: AuthedApi) {
  const res = await client.post('/api/recipes').send({
    title: 'Mac and cheese',
    servings: 2,
    ingredients: [
      { name: 'cheddar cheese', amount: 2, unit: 'cup', orderIndex: 0 },
      { name: 'onion', amount: 1, unit: 'whole', orderIndex: 1 },
      { name: 'unobtainium', amount: 1, unit: 'g', orderIndex: 2 },
    ],
    steps: [{ orderIndex: 0, instruction: 'Cook.', timeMinutes: 10, isActiveTime: true }],
  });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

beforeEach(async () => {
  await cleanupUsers();
  await prisma.ingredientCatalog.deleteMany();
  await seedGlobal('cheddar cheese');
  await seedGlobal('onion');
  api = await createAuthedApi(app);
  recipeId = await createRecipe(api);
});

afterAll(cleanupUsers);

describe('Seeded aisle defaults', () => {
  it('assigns every catalog entry an aisle from the vocabulary', () => {
    for (const [name, , , aisle] of INGREDIENT_CATALOG) {
      expect(AISLES, name).toContain(aisle);
    }
  });

  it('puts obvious items in obvious aisles', () => {
    const aisle = (n: string) => INGREDIENT_CATALOG.find(([name]) => name === n)?.[3];
    expect(aisle('onion')).toBe('produce');
    expect(aisle('cheddar cheese')).toBe('dairy-eggs');
    expect(aisle('chicken breast')).toBe('meat-seafood');
    expect(aisle('all-purpose flour')).toBe('baking-spices');
    expect(aisle('spaghetti')).toBe('dry-pasta-grains');
  });
});

describe('Grocery list aisles', () => {
  it('attaches a resolved aisle to every grocery item on create and read', async () => {
    const plan = await createPlan(api, recipeId);
    expect(aisleOf(plan.groceryList, 'cheddar cheese')).toBe('dairy-eggs');
    expect(aisleOf(plan.groceryList, 'onion')).toBe('produce');
    expect(aisleOf(plan.groceryList, 'unobtainium')).toBe('household-other');

    const res = await api.get(`/api/meal-plans/${plan.id}`);
    expect(res.status).toBe(200);
    expect(aisleOf(res.body.groceryList, 'cheddar cheese')).toBe('dairy-eggs');
    expect(aisleOf(res.body.groceryList, 'unobtainium')).toBe('household-other');
  });

  it("a user's private shadow with a different aisle wins, only for that user, and survives regeneration", async () => {
    const plan = await createPlan(api, recipeId);

    const shadow = await api
      .post('/api/ingredients')
      .send({ name: 'cheddar cheese', allergens: ['dairy'], diets: ['vegetarian'], aisle: 'deli' });
    expect(shadow.status).toBe(201);
    expect(shadow.body.aisle).toBe('deli');

    // Resolution is live, not stored on GroceryItem — the existing plan reflects it immediately.
    const read = await api.get(`/api/meal-plans/${plan.id}`);
    expect(aisleOf(read.body.groceryList, 'cheddar cheese')).toBe('deli');
    expect(aisleOf(read.body.groceryList, 'onion')).toBe('produce');

    // Regenerating the grocery list (recipes changed) keeps the override.
    const regen = await api.patch(`/api/meal-plans/${plan.id}`).send({ recipes: [{ recipeId, servings: 4 }] });
    expect(regen.status).toBe(200);
    expect(aisleOf(regen.body.groceryList, 'cheddar cheese')).toBe('deli');

    // Another user still gets the global default.
    const other = await createAuthedApi(app);
    const otherPlan = await createPlan(other, await createRecipe(other));
    expect(aisleOf(otherPlan.groceryList, 'cheddar cheese')).toBe('dairy-eggs');
  });

  it('a pre-existing private shadow without an aisle falls back to the global aisle', async () => {
    const own = await prisma.ingredientCatalog.create({
      data: { displayAlias: 'onion', allergens: [], diets: [], aisle: null, isUserAdded: true, userId: api.userId },
    });
    await prisma.ingredientAlias.create({ data: { alias: 'onion', catalogId: own.id, userId: api.userId } });

    const plan = await createPlan(api, recipeId);
    expect(aisleOf(plan.groceryList, 'onion')).toBe('produce');
  });
});

describe('Ingredient catalog aisle API', () => {
  it('includes aisle in GET /api/ingredients', async () => {
    const res = await api.get('/api/ingredients?q=onion');
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ displayAlias: 'onion', aisle: 'produce' });
  });

  it('a new shadow of a built-in inherits its aisle when none is given', async () => {
    const res = await api.post('/api/ingredients').send({ name: 'onion', allergens: [], diets: ['vegan'] });
    expect(res.status).toBe(201);
    expect(res.body.aisle).toBe('produce');
    expect(res.body.userId).toBe(api.userId);
  });

  it('updating an own entry without an aisle keeps it; with one, changes it', async () => {
    await api.post('/api/ingredients').send({ name: 'cheddar cheese', allergens: ['dairy'], diets: [], aisle: 'deli' });

    const keep = await api.post('/api/ingredients').send({ name: 'cheddar cheese', allergens: ['dairy'], diets: ['vegetarian'] });
    expect(keep.status).toBe(200);
    expect(keep.body.aisle).toBe('deli');

    const change = await api.patch(`/api/ingredients/${keep.body.id}`).send({ allergens: ['dairy'], diets: [], aisle: 'snacks' });
    expect(change.status).toBe(200);
    expect(change.body.aisle).toBe('snacks');

    const untouched = await api.patch(`/api/ingredients/${keep.body.id}`).send({ allergens: ['dairy'], diets: [] });
    expect(untouched.body.aisle).toBe('snacks');
  });

  it('rejects an aisle outside the vocabulary', async () => {
    const res = await api.post('/api/ingredients').send({ name: 'cheddar cheese', allergens: [], diets: [], aisle: 'cheese-cave' });
    expect(res.status).toBe(400);
  });
});
