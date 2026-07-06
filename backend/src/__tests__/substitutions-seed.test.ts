import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { prisma } from '../db.js';
import { SUBSTITUTION_SEED } from '../constants/substitutionSeed.js';
import { createAuthedApi, cleanupUsers, type AuthedApi } from './helpers/auth.js';

const app = createApp();
let api: AuthedApi;

/**
 * Mirrors the official-substitution block in prisma/seed.ts: findFirst on
 * (from, to, isOfficial) then create when absent. Kept in sync with the seed so this suite
 * exercises exactly the rows a fresh DB seed produces without wiping other tables.
 */
async function seedOfficialSubstitutions(): Promise<number> {
  let created = 0;
  for (const { from, to, ratio, notes } of SUBSTITUTION_SEED) {
    const fromIngredient = from.toLowerCase();
    const toIngredient = to.toLowerCase();
    const existing = await prisma.ingredientSubstitution.findFirst({
      where: { fromIngredient, toIngredient, isOfficial: true },
    });
    if (!existing) {
      await prisma.ingredientSubstitution.create({
        data: { fromIngredient, toIngredient, ratio, notes, isOfficial: true, createdBy: null },
      });
      created++;
    }
  }
  return created;
}

beforeEach(async () => {
  await prisma.ingredientSubstitution.deleteMany();
  await cleanupUsers();
  api = await createAuthedApi(app);
});

describe('Official substitution seed', () => {
  it('seeds the full curated official set', async () => {
    const created = await seedOfficialSubstitutions();
    expect(created).toBe(SUBSTITUTION_SEED.length);

    const officialCount = await prisma.ingredientSubstitution.count({ where: { isOfficial: true } });
    expect(officialCount).toBe(SUBSTITUTION_SEED.length);
    expect(officialCount).toBeGreaterThanOrEqual(40);

    // All seeded rows are global (createdBy null) and lowercase.
    const rows = await prisma.ingredientSubstitution.findMany();
    for (const row of rows) {
      expect(row.createdBy).toBeNull();
      expect(row.fromIngredient).toBe(row.fromIngredient.toLowerCase());
      expect(row.toIngredient).toBe(row.toIngredient.toLowerCase());
    }
  });

  it('is idempotent and leaves user substitutions untouched on reseed', async () => {
    await seedOfficialSubstitutions();

    // A user adds their own substitution.
    const userSub = await api.post('/api/substitutions').send({
      fromIngredient: 'butter',
      toIngredient: 'my special blend',
      ratio: 1,
    });
    expect(userSub.status).toBe(201);

    // Reseeding creates nothing new…
    const createdOnReseed = await seedOfficialSubstitutions();
    expect(createdOnReseed).toBe(0);
    const officialCount = await prisma.ingredientSubstitution.count({ where: { isOfficial: true } });
    expect(officialCount).toBe(SUBSTITUTION_SEED.length);

    // …and the user's row survives untouched.
    const survived = await prisma.ingredientSubstitution.findUnique({ where: { id: userSub.body.id } });
    expect(survived).not.toBeNull();
    expect(survived?.isOfficial).toBe(false);
    expect(survived?.createdBy).toBe(api.userId);
    expect(survived?.toIngredient).toBe('my special blend');
  });

  it('applies a seeded ratio end-to-end: 1 cup fresh basil → 1/3 cup dried', async () => {
    await seedOfficialSubstitutions();

    const recipe = await api.post('/api/recipes').send({
      title: 'Pesto',
      servings: 4,
      ingredients: [{ name: 'basil', amount: 1, unit: 'cup', orderIndex: 0 }],
    });
    expect(recipe.status).toBe(201);

    // The recipe-detail swap menu is fed by this endpoint.
    const res = await api.get(`/api/recipes/${recipe.body.id}/substitutions`);
    expect(res.status).toBe(200);
    const basilSub = res.body.find(
      (s: { fromIngredient: string; toIngredient: string }) =>
        s.fromIngredient === 'basil' && s.toIngredient === 'dried basil',
    );
    expect(basilSub).toBeDefined();
    expect(basilSub.isOfficial).toBe(true);
    expect(basilSub.ratio).toBeCloseTo(0.333, 3);

    // Swap-ratio semantics (from substitutions.service.ts + the swap UI): displayed amount is
    // the original amount multiplied by ratio. 1 cup fresh basil → ~1/3 cup dried.
    const originalAmount = recipe.body.ingredients[0].amount;
    const swappedAmount = originalAmount * basilSub.ratio;
    expect(swappedAmount).toBeCloseTo(1 / 3, 2);
  });
});
