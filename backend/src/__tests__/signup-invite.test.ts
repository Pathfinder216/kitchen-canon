import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { cleanupUsers } from './helpers/auth.js';

// Gated signup is driven by SIGNUP_INVITE_CODE, which config.ts reads once at import time. Set it
// before any import pulls in config, then dynamic-import the app so the value is picked up. (The
// rest of the suite never sets it, so registration stays open there — the "unset = open" case.)
const INVITE = 'test-invite-code';
let app: Express;

beforeAll(async () => {
  process.env.SIGNUP_INVITE_CODE = INVITE;
  const { createApp } = await import('../app.js');
  app = createApp();
});

beforeEach(async () => {
  await cleanupUsers();
});

describe('gated signup (SIGNUP_INVITE_CODE set)', () => {
  it('registers with the correct invite code', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'invited@example.com', password: 'password123', inviteCode: INVITE });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('invited@example.com');
  });

  it('rejects a missing invite code with 403', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'nocode@example.com', password: 'password123' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Invalid invite code' });
  });

  it('rejects a wrong invite code with 403', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'wrong@example.com', password: 'password123', inviteCode: 'nope' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Invalid invite code' });
  });
});
