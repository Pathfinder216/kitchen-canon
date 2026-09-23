import { readFileSync } from 'node:fs';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../app.js';
import { createAuthedApi, cleanupUsers, type AuthedApi } from './helpers/auth.js';
import { IMPORT_TEXT_MAX_LENGTH } from '../schemas/import.schema.js';

// POST /api/import/text — the server half of the photo/OCR import (plan 32). The browser runs
// tesseract and the user corrects the text; this endpoint just runs it through parseTextRecipe.

const app = createApp();
let api: AuthedApi;

function loadFixture(name: string): string {
  return readFileSync(new URL(`./fixtures/import/${name}`, import.meta.url), 'utf-8');
}

beforeEach(async () => {
  await cleanupUsers();
  api = await createAuthedApi(app);
});

describe('POST /api/import/text', () => {
  it('parses recipe-card text into a recipe', async () => {
    const res = await api.post('/api/import/text').send({ text: loadFixture('ocr-card.txt') });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Grandma's Oatmeal Cookies");
    expect(res.body.servings).toBe(24);
    expect(res.body.totalTime).toBe(35);
    expect(res.body.ingredients).toHaveLength(6);
    expect(res.body.ingredients[0]).toMatchObject({ amount: 1, unit: 'cup', name: 'butter, softened' });
    expect(res.body.ingredients[1].amount).toBeCloseTo(0.75);
    expect(res.body.ingredients[3].amount).toBeCloseTo(1.5);
    expect(res.body.steps).toHaveLength(4);
    // Leading "1." numbering is stripped from step text
    expect(res.body.steps[0].instruction).toBe('Heat oven to 350F.');
    expect(res.body.warnings).toEqual([]);
  });

  it('handles Windows line endings (text pasted/edited on any platform)', async () => {
    const text = loadFixture('ocr-card.txt').replace(/\n/g, '\r\n');
    const res = await api.post('/api/import/text').send({ text });
    expect(res.status).toBe(200);
    expect(res.body.ingredients).toHaveLength(6);
    expect(res.body.steps).toHaveLength(4);
  });

  it('rejects empty or whitespace-only text', async () => {
    const res = await api.post('/api/import/text').send({ text: '   \n  ' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing text field', async () => {
    const res = await api.post('/api/import/text').send({});
    expect(res.status).toBe(400);
  });

  it('rejects oversized text', async () => {
    const res = await api
      .post('/api/import/text')
      .send({ text: 'a'.repeat(IMPORT_TEXT_MAX_LENGTH + 1) });
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/import/text').send({ text: 'Soup' });
    // CSRF runs before requireAuth, so an anonymous POST without a token is refused either way.
    expect([401, 403]).toContain(res.status);
  });
});
