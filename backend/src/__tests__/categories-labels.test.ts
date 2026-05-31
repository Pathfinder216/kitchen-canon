import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { prisma } from '../db.js';
import { createAuthedApi, cleanupUsers, type AuthedApi } from './helpers/auth.js';

const app = createApp();
let api: AuthedApi;

/** Seed a global catalog ingredient (userId null) with a matching alias so it resolves. */
async function seedGlobalIngredient(displayAlias: string, allergens: string[], diets: string[]) {
  const entry = await prisma.ingredientCatalog.create({
    data: { displayAlias, allergens, diets, isUserAdded: false },
  });
  await prisma.ingredientAlias.create({ data: { alias: displayAlias, catalogId: entry.id } });
  return entry;
}

beforeEach(async () => {
  // Users cascade-delete recipes/meal plans; also clear global catalog + labels for isolation.
  await cleanupUsers();
  await prisma.label.deleteMany();
  await prisma.ingredientCatalog.deleteMany();
  api = await createAuthedApi(app);
});

describe('Courses', () => {
  it('lists all courses', async () => {
    const res = await api.get('/api/courses');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(11);
    expect(res.body.map((c: { type: string }) => c.type)).toContain('MAIN');
    expect(res.body.map((c: { type: string }) => c.type)).toContain('TOPPING');
  });

  it('assigns courses to a recipe', async () => {
    const recipe = await api.post('/api/recipes').send({ title: 'Pasta' });

    const res = await api
      .post(`/api/recipes/${recipe.body.id}/courses`)
      .send({ courseTypes: ['MAIN', 'SIDE'] });

    expect(res.status).toBe(200);
    expect(res.body.courses).toHaveLength(2);
    expect(res.body.courses.map((c: { courseType: string }) => c.courseType).sort()).toEqual(['MAIN', 'SIDE']);
  });

  it('replaces existing courses on reassign', async () => {
    const recipe = await api.post('/api/recipes').send({ title: 'Pasta' });
    await api.post(`/api/recipes/${recipe.body.id}/courses`).send({ courseTypes: ['MAIN'] });

    const res = await api
      .post(`/api/recipes/${recipe.body.id}/courses`)
      .send({ courseTypes: ['APPETIZER', 'SOUP'] });

    expect(res.body.courses).toHaveLength(2);
    expect(res.body.courses.map((c: { courseType: string }) => c.courseType).sort()).toEqual(['APPETIZER', 'SOUP']);
  });
});

describe('Labels', () => {
  it('creates a manual label', async () => {
    const res = await api.post('/api/labels').send({
      type: 'manual',
      name: 'freezable',
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('freezable');
    expect(res.body.type).toBe('manual');
  });

  it('rejects creating dietary or allergen labels via API', async () => {
    const res1 = await api.post('/api/labels').send({ type: 'dietary', name: 'vegan' });
    expect(res1.status).toBe(400);

    const res2 = await api.post('/api/labels').send({ type: 'allergen', name: 'dairy' });
    expect(res2.status).toBe(400);
  });

  it('lists labels', async () => {
    await api.post('/api/labels').send({ type: 'manual', name: 'freezable' });
    await api.post('/api/labels').send({ type: 'manual', name: 'slow cooker' });

    const res = await api.get('/api/labels');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filters labels by type', async () => {
    await api.post('/api/labels').send({ type: 'manual', name: 'freezable' });
    await api.post('/api/labels').send({ type: 'manual', name: 'slow cooker' });

    const manualRes = await api.get('/api/labels?type=manual');
    expect(manualRes.body).toHaveLength(2);

    const dietaryRes = await api.get('/api/labels?type=dietary');
    expect(dietaryRes.body).toHaveLength(0);
  });

  it('assigns labels to a recipe', async () => {
    const recipe = await api.post('/api/recipes').send({ title: 'Salad' });
    const label = await api.post('/api/labels').send({ type: 'manual', name: 'freezable' });

    const res = await api
      .post(`/api/recipes/${recipe.body.id}/labels`)
      .send({ labelIds: [label.body.id] });

    expect(res.status).toBe(200);
    const manualLabels = res.body.labels.filter((rl: { label: { type: string } }) => rl.label.type === 'manual');
    expect(manualLabels).toHaveLength(1);
    expect(manualLabels[0].label.name).toBe('freezable');
  });

  it('preserves dietary/allergen labels when reassigning manual labels', async () => {
    await seedGlobalIngredient('mushrooms', [], ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'nut_free', 'pescatarian']);

    const recipe = await api.post('/api/recipes').send({
      title: 'Mushroom Dish',
      ingredients: [{ name: 'mushrooms', orderIndex: 0 }],
    });

    // Recipe should have dietary labels from catalog
    const dietaryLabels = recipe.body.labels.filter((rl: { label: { type: string } }) => rl.label.type === 'dietary');
    expect(dietaryLabels.length).toBeGreaterThan(0);

    // Assign a manual label — dietary/allergen labels must survive
    const label = await api.post('/api/labels').send({ type: 'manual', name: 'freezable' });
    await api.post(`/api/recipes/${recipe.body.id}/labels`).send({ labelIds: [label.body.id] });

    const updated = await api.get(`/api/recipes/${recipe.body.id}`);
    const stillDietary = updated.body.labels.filter((rl: { label: { type: string } }) => rl.label.type === 'dietary');
    expect(stillDietary.length).toBeGreaterThan(0);
  });
});

describe('Recipe Filtering', () => {
  async function seedCatalog() {
    const all = ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'nut_free', 'pescatarian'];
    await seedGlobalIngredient('chicken', [], ['gluten_free', 'dairy_free', 'nut_free', 'pescatarian']);
    await seedGlobalIngredient('carrots', [], all);
    await seedGlobalIngredient('mushrooms', [], all);
    await seedGlobalIngredient('rice', [], all);
    await seedGlobalIngredient('lettuce', [], all);
    await seedGlobalIngredient('milk', ['dairy'], ['vegetarian', 'gluten_free', 'pescatarian']);
  }

  async function seedRecipes() {
    await seedCatalog();

    // Recipe 1: Chicken Soup (chicken + carrots → gluten_free but not vegan/vegetarian)
    const r1 = await api.post('/api/recipes').send({
      title: 'Chicken Soup',
      ingredients: [
        { name: 'chicken', amount: 1, unit: 'lb', orderIndex: 0 },
        { name: 'carrots', amount: 3, unit: 'medium', orderIndex: 1 },
      ],
      steps: [{ orderIndex: 0, instruction: 'Cook everything.' }],
    });

    // Recipe 2: Mushroom Risotto (mushrooms + rice → vegan, vegetarian, gluten_free)
    const r2 = await api.post('/api/recipes').send({
      title: 'Mushroom Risotto',
      ingredients: [
        { name: 'mushrooms', amount: 8, unit: 'oz', orderIndex: 0 },
        { name: 'rice', amount: 1, unit: 'cup', orderIndex: 1 },
      ],
      steps: [{ orderIndex: 0, instruction: 'Cook risotto.' }],
    });

    // Recipe 3: Chicken Salad (chicken + lettuce → gluten_free but not vegan/vegetarian)
    const r3 = await api.post('/api/recipes').send({
      title: 'Chicken Salad',
      ingredients: [
        { name: 'chicken', amount: 0.5, unit: 'lb', orderIndex: 0 },
        { name: 'lettuce', amount: 1, unit: 'head', orderIndex: 1 },
      ],
      steps: [{ orderIndex: 0, instruction: 'Toss together.' }],
    });

    await api.post(`/api/recipes/${r1.body.id}/courses`).send({ courseTypes: ['MAIN'] });
    await api.post(`/api/recipes/${r2.body.id}/courses`).send({ courseTypes: ['MAIN'] });
    await api.post(`/api/recipes/${r3.body.id}/courses`).send({ courseTypes: ['SALAD'] });

    return { r1, r2, r3 };
  }

  it('filters by ingredient inclusion', async () => {
    await seedRecipes();

    const res = await api.get('/api/recipes?includeIngredients=chicken');
    expect(res.body.recipes).toHaveLength(2);
    expect(res.body.recipes.map((r: { title: string }) => r.title).sort()).toEqual(['Chicken Salad', 'Chicken Soup']);
  });

  it('filters by ingredient exclusion', async () => {
    await seedRecipes();

    const res = await api.get('/api/recipes?excludeIngredients=mushrooms');
    expect(res.body.recipes).toHaveLength(2);
  });

  it('filters by manual label', async () => {
    await seedRecipes();

    const freeze = await api.post('/api/labels').send({ type: 'manual', name: 'freezable' });
    const quick = await api.post('/api/labels').send({ type: 'manual', name: 'quick' });

    const recipes = await api.get('/api/recipes');
    const ids = recipes.body.recipes.map((r: { id: string }) => r.id);

    await api.post(`/api/recipes/${ids[0]}/labels`).send({ labelIds: [freeze.body.id] });
    await api.post(`/api/recipes/${ids[1]}/labels`).send({ labelIds: [freeze.body.id] });
    await api.post(`/api/recipes/${ids[2]}/labels`).send({ labelIds: [quick.body.id] });

    const res = await api.get('/api/recipes?labels=freezable');
    expect(res.body.recipes).toHaveLength(2);

    const res2 = await api.get('/api/recipes?labels=quick');
    expect(res2.body.recipes).toHaveLength(1);
  });

  it('filters by diet (stored auto-generated labels)', async () => {
    await seedRecipes();

    // Only Mushroom Risotto is vegetarian (chicken recipes are not)
    const res = await api.get('/api/recipes?diets=vegetarian');
    expect(res.body.recipes).toHaveLength(1);
    expect(res.body.recipes[0].title).toBe('Mushroom Risotto');

    // Chicken Soup, Chicken Salad, and Mushroom Risotto are all gluten_free
    const res2 = await api.get('/api/recipes?diets=gluten_free');
    expect(res2.body.recipes).toHaveLength(3);
  });

  it('filters by allergen exclusion (freeFrom)', async () => {
    await seedCatalog();

    // Recipe with dairy
    const r1 = await api.post('/api/recipes').send({
      title: 'Cream Soup',
      ingredients: [
        { name: 'milk', amount: 1, unit: 'cup', orderIndex: 0 },
        { name: 'mushrooms', amount: 8, unit: 'oz', orderIndex: 1 },
      ],
      steps: [{ orderIndex: 0, instruction: 'Heat.' }],
    });
    // Recipe without dairy
    const r2 = await api.post('/api/recipes').send({
      title: 'Mushroom Soup',
      ingredients: [
        { name: 'mushrooms', amount: 8, unit: 'oz', orderIndex: 0 },
      ],
      steps: [{ orderIndex: 0, instruction: 'Heat.' }],
    });

    expect(r1.body.labels.some((rl: { label: { type: string; name: string } }) =>
      rl.label.type === 'allergen' && rl.label.name === 'dairy'
    )).toBe(true);

    const res = await api.get('/api/recipes?freeFrom=dairy');
    expect(res.body.recipes).toHaveLength(1);
    expect(res.body.recipes[0].title).toBe('Mushroom Soup');
  });

  it('auto-generated labels are stored on recipe create', async () => {
    await seedCatalog();

    const recipe = await api.post('/api/recipes').send({
      title: 'Vegan Bowl',
      ingredients: [
        { name: 'mushrooms', amount: 1, unit: 'cup', orderIndex: 0 },
        { name: 'rice', amount: 1, unit: 'cup', orderIndex: 1 },
      ],
      steps: [{ orderIndex: 0, instruction: 'Cook.' }],
    });

    const autoLabels = recipe.body.labels.filter((rl: { label: { type: string } }) => rl.label.type !== 'manual');
    const labelNames = autoLabels.map((rl: { label: { name: string } }) => rl.label.name);
    expect(labelNames).toContain('vegan');
    expect(labelNames).toContain('vegetarian');
    expect(labelNames).toContain('gluten_free');
  });

  it('filters by course', async () => {
    await seedRecipes();

    const res = await api.get('/api/recipes?courses=MAIN');
    expect(res.body.recipes).toHaveLength(2);

    const res2 = await api.get('/api/recipes?courses=SALAD');
    expect(res2.body.recipes).toHaveLength(1);
    expect(res2.body.recipes[0].title).toBe('Chicken Salad');
  });

  it('combines multiple filters', async () => {
    await seedRecipes();

    // Chicken + gluten_free = Chicken Soup and Chicken Salad
    const res = await api.get('/api/recipes?includeIngredients=chicken&diets=gluten_free');
    expect(res.body.recipes).toHaveLength(2);

    // Chicken + MAIN course = only Chicken Soup
    const res2 = await api.get('/api/recipes?includeIngredients=chicken&courses=MAIN');
    expect(res2.body.recipes).toHaveLength(1);
    expect(res2.body.recipes[0].title).toBe('Chicken Soup');
  });

  it('combines search with filters', async () => {
    await seedRecipes();

    const res = await api.get('/api/recipes?search=Chicken&courses=MAIN');
    expect(res.body.recipes).toHaveLength(1);
    expect(res.body.recipes[0].title).toBe('Chicken Soup');
  });
});
