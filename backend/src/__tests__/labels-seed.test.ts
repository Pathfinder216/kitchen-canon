import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { prisma } from '../db.js';
import { createAuthedApi, cleanupUsers, type AuthedApi } from './helpers/auth.js';

const app = createApp();
let api: AuthedApi;

/**
 * The standard global manual labels seeded by prisma/seed.ts (STANDARD_LABELS). Mirrored here so
 * this suite exercises exactly the rows a fresh DB seed produces. Keep in sync with seed.ts.
 * Includes the equipment + make-ahead/storage vocabulary added by plan 25.
 */
const STANDARD_LABEL_NAMES = [
  'Make-ahead',
  'Freezable',
  'Refrigerate up to 3 days',
  'Night-before prep',
  'Slow cooker',
  'Instant Pot / pressure cooker',
  'Air fryer',
  'Oven',
  'Stovetop only',
  'No-cook',
  'Grill',
  'Blender / food processor',
  'Stand mixer',
  'Quick',
  'Budget-friendly',
];

/**
 * Mirrors the standard-label block in prisma/seed.ts: findFirst on (type, name, userId: null)
 * then create when absent. Global labels use userId null, which SQLite treats as distinct in the
 * compound unique index, so they can't be upserted/deduped — findFirst + create is required.
 */
async function seedStandardLabels(): Promise<number> {
  let created = 0;
  for (const name of STANDARD_LABEL_NAMES) {
    const existing = await prisma.label.findFirst({ where: { type: 'manual', name, userId: null } });
    if (!existing) {
      await prisma.label.create({ data: { type: 'manual', name } });
      created++;
    }
  }
  return created;
}

beforeEach(async () => {
  await cleanupUsers();
  await prisma.label.deleteMany();
  api = await createAuthedApi(app);
});

describe('Standard label seed', () => {
  it('seeds the full standard global label set (equipment + make-ahead + general)', async () => {
    const created = await seedStandardLabels();
    expect(created).toBe(STANDARD_LABEL_NAMES.length);

    const globals = await prisma.label.findMany({ where: { type: 'manual', userId: null } });
    expect(globals).toHaveLength(STANDARD_LABEL_NAMES.length);
    for (const label of globals) {
      expect(label.userId).toBeNull();
      expect(label.type).toBe('manual');
    }
    // Equipment + make-ahead vocabulary is present.
    const names = globals.map((l) => l.name);
    expect(names).toContain('Slow cooker');
    expect(names).toContain('Instant Pot / pressure cooker');
    expect(names).toContain('Air fryer');
    expect(names).toContain('Refrigerate up to 3 days');
    expect(names).toContain('Night-before prep');
  });

  it('is idempotent: reseeding creates nothing and keeps the count stable', async () => {
    await seedStandardLabels();
    const firstCount = await prisma.label.count({ where: { type: 'manual', userId: null } });
    expect(firstCount).toBe(STANDARD_LABEL_NAMES.length);

    const createdOnReseed = await seedStandardLabels();
    expect(createdOnReseed).toBe(0);

    const secondCount = await prisma.label.count({ where: { type: 'manual', userId: null } });
    expect(secondCount).toBe(firstCount);
  });

  it('exposes the new globals through GET /api/labels', async () => {
    await seedStandardLabels();

    const res = await api.get('/api/labels?type=manual');
    expect(res.status).toBe(200);
    const names = res.body.map((l: { name: string }) => l.name);
    for (const expected of STANDARD_LABEL_NAMES) {
      expect(names).toContain(expected);
    }
  });

  it('leaves a user-created label untouched on reseed', async () => {
    await seedStandardLabels();

    const userLabel = await api.post('/api/labels').send({ type: 'manual', name: 'My Special Label' });
    expect(userLabel.status).toBe(201);
    expect(userLabel.body.userId).toBe(api.userId);

    // Reseeding creates none of the standard labels again and does not touch the user's row.
    const createdOnReseed = await seedStandardLabels();
    expect(createdOnReseed).toBe(0);

    const survived = await prisma.label.findUnique({ where: { id: userLabel.body.id } });
    expect(survived).not.toBeNull();
    expect(survived?.userId).toBe(api.userId);
    expect(survived?.name).toBe('My Special Label');

    // The user's own label is not duplicated as a global.
    const globalDupes = await prisma.label.count({ where: { name: 'My Special Label', userId: null } });
    expect(globalDupes).toBe(0);
  });
});
