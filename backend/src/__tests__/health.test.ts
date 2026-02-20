import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

const app = createApp();

describe('Health Endpoint', () => {
  it('GET /api/health returns ok status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
