import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// CSP is production-only (app.ts): in dev/test the frontend is served by Vite, not this process,
// so a strict policy would only ever bite the prod bundle. config.ts reads NODE_ENV once at import
// time and is a module singleton, so each mode needs vi.resetModules() + a fresh import of the app
// under the right NODE_ENV. (This file therefore never imports the app statically.)

async function makeApp(nodeEnv: string): Promise<Express> {
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  vi.resetModules();
  const { createApp } = await import('../app.js');
  const app = createApp();
  process.env.NODE_ENV = saved;
  return app;
}

describe('Content-Security-Policy', () => {
  it('is absent in test mode', async () => {
    const app = await makeApp('test');
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toBeUndefined();
  });

  describe('production mode', () => {
    let prodApp: Express;

    beforeAll(async () => {
      prodApp = await makeApp('production');
    });

    afterAll(() => {
      vi.resetModules();
    });

    it('sets a Content-Security-Policy header', async () => {
      const res = await request(prodApp).get('/api/health');
      expect(res.status).toBe(200);
      const csp = res.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      // scriptSrc must never relax to 'unsafe-inline'
      expect(csp).toMatch(/script-src 'self'(;|$)/);
    });
  });
});
