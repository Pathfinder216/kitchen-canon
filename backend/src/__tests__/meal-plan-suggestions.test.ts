import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { prisma } from '../db.js';
import { createAuthedApi, cleanupUsers, type AuthedApi } from './helpers/auth.js';

const app = createApp();
let api: AuthedApi;

const ALL = ['vegan', 'vegetarian', 'pescatarian', 'gluten_free', 'dairy_free', 'nut_free'];
const MEAT = ['gluten_free', 'dairy_free', 'nut_free'];
const DAIRY = ['vegetarian', 'pescatarian', 'gluten_free', 'nut_free'];

/** Seed a global catalog ingredient (userId null) with a matching alias so it resolves. */
async function seedGlobalIngredient(displayAlias: string, allergens: string[], diets: string[]) {
  const entry = await prisma.ingredientCatalog.create({ data: { displayAlias, allergens, diets } });
  await prisma.ingredientAlias.create({ data: { alias: displayAlias, catalogId: entry.id } });
}

async function createRecipe(client: AuthedApi, title: string, ingredients: string[], courses: string[]): Promise<string> {
  const res = await client.post('/api/recipes').send({
    title,
    servings: 2,
    ingredients: ingredients.map((name, i) => ({ name, amount: 1, orderIndex: i })),
    steps: [],
  });
  expect(res.status).toBe(201);
  if (courses.length > 0) {
    const c = await client.post(`/api/recipes/${res.body.id}/courses`).send({ courseTypes: courses });
    expect(c.status).toBe(200);
  }
  return res.body.id as string;
}

let ids: Record<string, string>;

beforeEach(async () => {
  await cleanupUsers();
  await prisma.label.deleteMany();
  await prisma.ingredientCatalog.deleteMany();
  api = await createAuthedApi(app);

  await seedGlobalIngredient('lettuce', [], ALL);
  await seedGlobalIngredient('olive oil', [], ALL);
  await seedGlobalIngredient('potato', [], ALL);
  await seedGlobalIngredient('chicken breast', [], MEAT);
  await seedGlobalIngredient('butter', ['dairy'], DAIRY);
  await seedGlobalIngredient('cucumber', [], ALL);

  ids = {
    saladMain: await createRecipe(api, 'Big salad bowl', ['lettuce', 'olive oil'], ['MAIN', 'SALAD']),
    cucumberSalad: await createRecipe(api, 'Cucumber salad', ['cucumber', 'olive oil'], ['SALAD']),
    roastPotatoes: await createRecipe(api, 'Roast potatoes', ['potato', 'olive oil'], ['SIDE']),
    butterMash: await createRecipe(api, 'Butter mash', ['potato', 'butter'], ['SIDE']),
    chicken: await createRecipe(api, 'Roast chicken', ['chicken breast', 'olive oil'], ['MAIN']),
    sorbet: await createRecipe(api, 'Cucumber sorbet', ['cucumber'], ['DESSERT']),
  };
});

describe('GET /api/meal-plans/suggestions', () => {
  it('suggests complements for a salad main — never another salad on top — with reasons', async () => {
    const res = await api.get(`/api/meal-plans/suggestions?recipeIds=${ids.saladMain}`);
    expect(res.status).toBe(200);
    const titles = res.body.map((s: { recipe: { title: string } }) => s.recipe.title);

    expect(titles[0]).not.toMatch(/salad/i);
    expect(titles.slice(0, 2)).toEqual(['Roast potatoes', 'Cucumber sorbet']);
    expect(titles).not.toContain('Big salad bowl'); // already selected
    expect(titles).not.toContain('Roast chicken'); // breaks the vegan meal + redundant main

    const top = res.body[0];
    expect(top.recipe).toMatchObject({ id: ids.roastPotatoes, servings: 2, courses: ['SIDE'] });
    expect(top.reasons).toEqual(['fills side course', 'keeps meal vegan', 'shares 1 ingredient', 'not cooked recently']);
    expect(top.score).toBe(3 + 2 + 0.5 + 1);
  });

  it('returns at most 6 suggestions', async () => {
    for (let i = 0; i < 6; i++) await createRecipe(api, `Extra side ${i}`, ['potato'], ['SIDE']);
    const res = await api.get(`/api/meal-plans/suggestions?recipeIds=${ids.saladMain}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
  });

  it('with no selection, starts with mains', async () => {
    const res = await api.get('/api/meal-plans/suggestions');
    expect(res.status).toBe(200);
    expect(res.body.slice(0, 2).map((s: { recipe: { title: string } }) => s.recipe.title)).toEqual([
      'Big salad bowl',
      'Roast chicken',
    ]);
  });

  it('respects the dietary filter by excluding non-matching candidates', async () => {
    const res = await api.get(`/api/meal-plans/suggestions?recipeIds=${ids.chicken}&freeFrom=dairy&diets=gluten_free`);
    expect(res.status).toBe(200);
    const titles = res.body.map((s: { recipe: { title: string } }) => s.recipe.title);
    expect(titles).toContain('Roast potatoes');
    expect(titles).not.toContain('Butter mash');
  });

  it('does not count a recipe cooked in the last 30 days as novel', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await api.post('/api/meal-plans').send({ name: 'Last night', date: today, recipes: [{ recipeId: ids.roastPotatoes, servings: 2 }] });
    const res = await api.get(`/api/meal-plans/suggestions?recipeIds=${ids.saladMain}`);
    const potatoes = res.body.find((s: { recipe: { id: string } }) => s.recipe.id === ids.roastPotatoes);
    expect(potatoes.reasons).not.toContain('not cooked recently');
  });

  it('excludes the latest version of a selected older version and still resolves its facts', async () => {
    const edit = await api.patch(`/api/recipes/${ids.roastPotatoes}`).send({ title: 'Roast potatoes v2' });
    expect(edit.status).toBe(200);
    const res = await api.get(`/api/meal-plans/suggestions?recipeIds=${ids.roastPotatoes}`);
    expect(res.status).toBe(200);
    const titles = res.body.map((s: { recipe: { title: string } }) => s.recipe.title);
    expect(titles).not.toContain('Roast potatoes v2');
  });

  it('returns [] when the user has fewer than 5 recipes', async () => {
    const other = await createAuthedApi(app);
    const a = await createRecipe(other, 'Only main', ['potato'], ['MAIN']);
    await createRecipe(other, 'Only side', ['potato'], ['SIDE']);
    const res = await other.get(`/api/meal-plans/suggestions?recipeIds=${a}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("404s when a selected id belongs to another user", async () => {
    const other = await createAuthedApi(app);
    const res = await other.get(`/api/meal-plans/suggestions?recipeIds=${ids.saladMain}`);
    expect(res.status).toBe(404);
  });

  it('never suggests another user\'s recipes', async () => {
    const other = await createAuthedApi(app);
    for (let i = 0; i < 5; i++) await createRecipe(other, `Theirs ${i}`, ['potato'], ['MAIN']);
    const res = await api.get('/api/meal-plans/suggestions');
    expect(res.body.every((s: { recipe: { title: string } }) => !s.recipe.title.startsWith('Theirs'))).toBe(true);
  });
});
