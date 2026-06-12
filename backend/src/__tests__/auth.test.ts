import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createAuthedApi, cleanupUsers } from './helpers/auth.js';

const app = createApp();

beforeEach(async () => {
  await cleanupUsers();
});

describe('POST /api/auth/register', () => {
  it('registers a user and sets a session cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('new@example.com');
    expect(res.body.id).toBeDefined();
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie'].some((c: string) => c.startsWith('ltc_session='))).toBe(true);
  });

  it('lowercases and trims the email', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ email: '  Mixed@Example.COM ', password: 'password123' });
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('mixed@example.com');
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send({ email: 'dup@example.com', password: 'password123' });
    const res = await request(app).post('/api/auth/register').send({ email: 'dup@example.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('rejects a weak password with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'weak@example.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('accepts a blank/absent invite code when signup is open (empty SIGNUP_INVITE_CODE)', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'open@example.com', password: 'password123' });
    expect(res.status).toBe(201);
  });

  it('rejects a non-empty invite code when signup is open (the empty code is the only match)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'coded@example.com', password: 'password123', inviteCode: 'unexpected' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send({ email: 'user@example.com', password: 'password123' });
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'user@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('user@example.com');
    expect(res.headers['set-cookie'].some((c: string) => c.startsWith('ltc_session='))).toBe(true);
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'user@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown email with the same 401 message (no enumeration)', async () => {
    const wrongPw = await request(app).post('/api/auth/login').send({ email: 'user@example.com', password: 'wrongpassword' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'password123' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error).toBe(wrongPw.body.error);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without a session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user with a session', async () => {
    const api = await createAuthedApi(app, 'me@example.com');
    const res = await api.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('me@example.com');
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the session so /me returns 401 afterward', async () => {
    const api = await createAuthedApi(app);
    const before = await api.get('/api/auth/me');
    expect(before.status).toBe(200);

    const logout = await api.post('/api/auth/logout');
    expect(logout.status).toBe(204);

    const after = await api.get('/api/auth/me');
    expect(after.status).toBe(401);
  });
});

describe('CSRF protection', () => {
  it('rejects a state-changing request without the CSRF token (403)', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ email: 'csrf@example.com', password: 'password123' });
    // No x-csrf-token header — should be rejected by the double-submit check.
    const res = await agent.post('/api/recipes').send({ title: 'No CSRF' });
    expect(res.status).toBe(403);
  });

  it('allows a state-changing request with the CSRF token', async () => {
    const api = await createAuthedApi(app, 'csrf-ok@example.com');
    const res = await api.post('/api/recipes').send({ title: 'With CSRF' });
    expect(res.status).toBe(201);
  });
});
