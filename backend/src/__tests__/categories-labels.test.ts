import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../db.js';

const app = createApp();

beforeEach(async () => {
  await prisma.recipeLabel.deleteMany();
  await prisma.recipeCategory.deleteMany();
  await prisma.step.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.label.deleteMany();
  await prisma.category.deleteMany();
});

describe('Categories', () => {
  it('creates a category', async () => {
    const res = await request(app).post('/api/categories').send({ name: 'dinner' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('dinner');
  });

  it('lists categories', async () => {
    await request(app).post('/api/categories').send({ name: 'dinner' });
    await request(app).post('/api/categories').send({ name: 'appetizer' });

    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // sorted alphabetically
    expect(res.body[0].name).toBe('appetizer');
    expect(res.body[1].name).toBe('dinner');
  });

  it('assigns categories to a recipe', async () => {
    const recipe = await request(app).post('/api/recipes').send({ title: 'Pasta' });
    const cat1 = await request(app).post('/api/categories').send({ name: 'dinner' });
    const cat2 = await request(app).post('/api/categories').send({ name: 'entree' });

    const res = await request(app)
      .post(`/api/recipes/${recipe.body.id}/categories`)
      .send({ categoryIds: [cat1.body.id, cat2.body.id] });

    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(2);
  });
});

describe('Labels', () => {
  it('creates a label', async () => {
    const res = await request(app).post('/api/labels').send({
      type: 'dietary',
      name: 'gluten-free',
      autoDetectable: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('gluten-free');
    expect(res.body.type).toBe('dietary');
  });

  it('lists labels', async () => {
    await request(app).post('/api/labels').send({ type: 'dietary', name: 'gluten-free' });
    await request(app).post('/api/labels').send({ type: 'allergen', name: 'contains-nuts' });

    const res = await request(app).get('/api/labels');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filters labels by type', async () => {
    await request(app).post('/api/labels').send({ type: 'dietary', name: 'vegan' });
    await request(app).post('/api/labels').send({ type: 'allergen', name: 'contains-dairy' });

    const res = await request(app).get('/api/labels?type=dietary');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('vegan');
  });

  it('assigns labels to a recipe', async () => {
    const recipe = await request(app).post('/api/recipes').send({ title: 'Salad' });
    const label = await request(app).post('/api/labels').send({ type: 'dietary', name: 'vegan' });

    const res = await request(app)
      .post(`/api/recipes/${recipe.body.id}/labels`)
      .send({ labelIds: [label.body.id] });

    expect(res.status).toBe(200);
    expect(res.body.labels).toHaveLength(1);
    expect(res.body.labels[0].label.name).toBe('vegan');
  });
});

describe('Recipe Filtering', () => {
  async function seedRecipes() {
    // Recipe 1: Chicken Soup (has chicken, carrots; dinner, gluten-free)
    const r1 = await request(app).post('/api/recipes').send({
      title: 'Chicken Soup',
      ingredients: [
        { name: 'chicken', amount: 1, unit: 'lb', orderIndex: 0, internalId: 'chicken_1' },
        { name: 'carrots', amount: 3, unit: 'medium', orderIndex: 1, internalId: 'carrots_1' },
      ],
      steps: [{ orderIndex: 0, instruction: 'Cook everything.' }],
    });

    // Recipe 2: Mushroom Risotto (has mushrooms, rice; dinner, vegetarian)
    const r2 = await request(app).post('/api/recipes').send({
      title: 'Mushroom Risotto',
      ingredients: [
        { name: 'mushrooms', amount: 8, unit: 'oz', orderIndex: 0, internalId: 'mush_1' },
        { name: 'rice', amount: 1, unit: 'cup', orderIndex: 1, internalId: 'rice_1' },
      ],
      steps: [{ orderIndex: 0, instruction: 'Cook risotto.' }],
    });

    // Recipe 3: Chicken Salad (has chicken, lettuce; lunch, gluten-free)
    const r3 = await request(app).post('/api/recipes').send({
      title: 'Chicken Salad',
      ingredients: [
        { name: 'chicken', amount: 0.5, unit: 'lb', orderIndex: 0, internalId: 'chicken_1' },
        { name: 'lettuce', amount: 1, unit: 'head', orderIndex: 1, internalId: 'lettuce_1' },
      ],
      steps: [{ orderIndex: 0, instruction: 'Toss together.' }],
    });

    // Add categories and labels
    const dinner = await request(app).post('/api/categories').send({ name: 'dinner' });
    const lunch = await request(app).post('/api/categories').send({ name: 'lunch' });
    const gf = await request(app).post('/api/labels').send({ type: 'dietary', name: 'gluten-free' });
    const veg = await request(app).post('/api/labels').send({ type: 'dietary', name: 'vegetarian' });

    // Assign
    await request(app).post(`/api/recipes/${r1.body.id}/categories`).send({ categoryIds: [dinner.body.id] });
    await request(app).post(`/api/recipes/${r2.body.id}/categories`).send({ categoryIds: [dinner.body.id] });
    await request(app).post(`/api/recipes/${r3.body.id}/categories`).send({ categoryIds: [lunch.body.id] });

    await request(app).post(`/api/recipes/${r1.body.id}/labels`).send({ labelIds: [gf.body.id] });
    await request(app).post(`/api/recipes/${r2.body.id}/labels`).send({ labelIds: [veg.body.id] });
    await request(app).post(`/api/recipes/${r3.body.id}/labels`).send({ labelIds: [gf.body.id] });
  }

  it('filters by ingredient inclusion', async () => {
    await seedRecipes();

    const res = await request(app).get('/api/recipes?includeIngredients=chicken');
    expect(res.body.recipes).toHaveLength(2);
    expect(res.body.recipes.map((r: { title: string }) => r.title).sort()).toEqual(['Chicken Salad', 'Chicken Soup']);
  });

  it('filters by ingredient exclusion', async () => {
    await seedRecipes();

    const res = await request(app).get('/api/recipes?excludeIngredients=mushrooms');
    expect(res.body.recipes).toHaveLength(2);
  });

  it('filters by label', async () => {
    await seedRecipes();

    const res = await request(app).get('/api/recipes?labels=gluten-free');
    expect(res.body.recipes).toHaveLength(2);

    const res2 = await request(app).get('/api/recipes?labels=vegetarian');
    expect(res2.body.recipes).toHaveLength(1);
    expect(res2.body.recipes[0].title).toBe('Mushroom Risotto');
  });

  it('filters by category', async () => {
    await seedRecipes();

    const res = await request(app).get('/api/recipes?categories=dinner');
    expect(res.body.recipes).toHaveLength(2);

    const res2 = await request(app).get('/api/recipes?categories=lunch');
    expect(res2.body.recipes).toHaveLength(1);
    expect(res2.body.recipes[0].title).toBe('Chicken Salad');
  });

  it('combines multiple filters', async () => {
    await seedRecipes();

    // Chicken + gluten-free = Chicken Soup and Chicken Salad
    const res = await request(app).get('/api/recipes?includeIngredients=chicken&labels=gluten-free');
    expect(res.body.recipes).toHaveLength(2);

    // Chicken + dinner category = only Chicken Soup
    const res2 = await request(app).get('/api/recipes?includeIngredients=chicken&categories=dinner');
    expect(res2.body.recipes).toHaveLength(1);
    expect(res2.body.recipes[0].title).toBe('Chicken Soup');
  });

  it('combines search with filters', async () => {
    await seedRecipes();

    const res = await request(app).get('/api/recipes?search=Chicken&categories=dinner');
    expect(res.body.recipes).toHaveLength(1);
    expect(res.body.recipes[0].title).toBe('Chicken Soup');
  });
});
