import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { prisma } from '../db.js';
import { createAuthedApi, cleanupUsers, type AuthedApi } from './helpers/auth.js';

const app = createApp();
let alice: AuthedApi;
let bob: AuthedApi;

beforeEach(async () => {
  await prisma.ingredientSubstitution.deleteMany();
  await prisma.label.deleteMany();
  await prisma.ingredientCatalog.deleteMany();
  await cleanupUsers();
  alice = await createAuthedApi(app, 'alice@example.com');
  bob = await createAuthedApi(app, 'bob@example.com');
});

describe('Recipe isolation', () => {
  it("does not expose Alice's recipe to Bob", async () => {
    const created = await alice.post('/api/recipes').send({ title: "Alice's Secret" });
    expect(created.status).toBe(201);

    const bobList = await bob.get('/api/recipes');
    expect(bobList.body.recipes).toHaveLength(0);

    const bobGet = await bob.get(`/api/recipes/${created.body.id}`);
    expect(bobGet.status).toBe(404);
  });

  it("prevents Bob from adding Alice's recipe to his meal plan", async () => {
    const created = await alice.post('/api/recipes').send({ title: "Alice's Dish" });
    const res = await bob.post('/api/meal-plans').send({
      recipes: [{ recipeId: created.body.id, servings: 2 }],
    });
    expect(res.status).toBe(400);
  });
});

describe('Meal plan isolation', () => {
  it("does not expose Alice's meal plan to Bob", async () => {
    const recipe = await alice.post('/api/recipes').send({ title: 'For Plan' });
    const plan = await alice.post('/api/meal-plans').send({
      recipes: [{ recipeId: recipe.body.id, servings: 2 }],
    });
    expect(plan.status).toBe(201);

    const bobList = await bob.get('/api/meal-plans');
    expect(bobList.body).toHaveLength(0);

    const bobGet = await bob.get(`/api/meal-plans/${plan.body.id}`);
    expect(bobGet.status).toBe(404);
  });
});

describe('Substitution isolation', () => {
  it("keeps Alice's private substitution out of Bob's list, but shares official ones", async () => {
    await alice.post('/api/substitutions').send({ fromIngredient: 'butter', toIngredient: 'ghee', ratio: 1 });
    // An official/global substitution (createdBy null) is visible to everyone.
    await prisma.ingredientSubstitution.create({
      data: { fromIngredient: 'milk', toIngredient: 'oat milk', ratio: 1, isOfficial: true },
    });

    const bobList = await bob.get('/api/substitutions');
    const fromIngredients = bobList.body.map((s: { fromIngredient: string }) => s.fromIngredient);
    expect(fromIngredients).toContain('milk'); // official, shared
    expect(fromIngredients).not.toContain('butter'); // Alice's private one
  });

  it("prevents Bob from deleting Alice's substitution", async () => {
    const sub = await alice.post('/api/substitutions').send({ fromIngredient: 'eggs', toIngredient: 'flax egg', ratio: 1 });
    const res = await bob.delete(`/api/substitutions/${sub.body.id}`);
    expect(res.status).toBe(404);
  });
});

describe('Ingredient catalog supplement isolation', () => {
  it("keeps Alice's private ingredient out of Bob's catalog, but shares global ones", async () => {
    // Global seeded ingredient (userId null) — visible to all.
    const global = await prisma.ingredientCatalog.create({
      data: { displayAlias: 'tofu', allergens: ['soy'], diets: [], isUserAdded: false },
    });
    await prisma.ingredientAlias.create({ data: { alias: 'tofu', catalogId: global.id } });

    // Alice adds a private ingredient.
    await alice.post('/api/ingredients').send({ name: 'alice-spice', allergens: [], diets: [] });

    const bobList = await bob.get('/api/ingredients');
    const names = bobList.body.map((e: { displayAlias: string }) => e.displayAlias);
    expect(names).toContain('tofu'); // global
    expect(names).not.toContain('alice-spice'); // Alice's private

    const aliceList = await alice.get('/api/ingredients');
    const aliceNames = aliceList.body.map((e: { displayAlias: string }) => e.displayAlias);
    expect(aliceNames).toContain('alice-spice');
    expect(aliceNames).toContain('tofu');
  });

  it("resolves a user's private ingredient for dietary info without leaking to another user", async () => {
    // Alice classifies "mystery" as containing peanuts; Bob classifies the same name as soy.
    await alice.post('/api/ingredients').send({ name: 'mystery', allergens: ['peanuts'], diets: [] });
    await bob.post('/api/ingredients').send({ name: 'mystery', allergens: ['soy'], diets: [] });

    const aliceRecipe = await alice.post('/api/recipes').send({
      title: "Alice Mystery", ingredients: [{ name: 'mystery', orderIndex: 0 }],
    });
    const aliceAllergens = aliceRecipe.body.labels
      .filter((rl: { label: { type: string } }) => rl.label.type === 'allergen')
      .map((rl: { label: { name: string } }) => rl.label.name);
    expect(aliceAllergens).toContain('peanuts');
    expect(aliceAllergens).not.toContain('soy');
  });
});

describe('Label supplement isolation', () => {
  it("keeps Alice's private label out of Bob's list", async () => {
    await alice.post('/api/labels').send({ type: 'manual', name: 'alice-only' });
    const bobLabels = await bob.get('/api/labels');
    const names = bobLabels.body.map((l: { name: string }) => l.name);
    expect(names).not.toContain('alice-only');
  });
});
