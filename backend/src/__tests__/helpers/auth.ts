import request from 'supertest';
import type { Express } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../../db.js';

/**
 * An authenticated test client with the same fluent surface as `request(app)`. It wraps a
 * supertest agent (which persists the session + CSRF cookies) and auto-attaches the
 * x-csrf-token header on every request, so existing tests can swap `request(app)` for this.
 */
export interface AuthedApi {
  get: (url: string) => request.Test;
  post: (url: string) => request.Test;
  patch: (url: string) => request.Test;
  delete: (url: string) => request.Test;
  agent: ReturnType<typeof request.agent>;
  token: string;
  userId: string;
  email: string;
}

export const TEST_PASSWORD = 'password123';

/** Register a fresh user and return an authenticated client bound to that user's session. */
export async function createAuthedApi(app: Express, email?: string): Promise<AuthedApi> {
  const agent = request.agent(app);
  const mail = email ?? `user-${randomUUID().slice(0, 8)}@example.com`;
  const reg = await agent.post('/api/auth/register').send({ email: mail, password: TEST_PASSWORD });
  if (reg.status !== 201) {
    throw new Error(`Test user registration failed (${reg.status}): ${JSON.stringify(reg.body)}`);
  }
  const csrf = await agent.get('/api/auth/csrf');
  const token = csrf.body.csrfToken as string;
  const withToken = (t: request.Test) => t.set('x-csrf-token', token);
  return {
    agent,
    token,
    userId: reg.body.id,
    email: mail,
    get: (url) => withToken(agent.get(url)),
    post: (url) => withToken(agent.post(url)),
    patch: (url) => withToken(agent.patch(url)),
    delete: (url) => withToken(agent.delete(url)),
  };
}

/**
 * Remove all users (cascades sessions, recipes, meal plans, and per-user catalog/label/
 * substitution rows). Global seeded reference data (userId null) is left intact.
 */
export async function cleanupUsers(): Promise<void> {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}
