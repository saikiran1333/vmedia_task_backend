import { test, describe } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';

describe('Vmedia Backend API Test Suite', () => {
  // Verifies root service discovery endpoint.
  test('GET / should return 200 with service metadata and documentation links', async () => {
    const res = await request(app).get('/');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.name, 'Vmedia Backend API');
    assert.strictEqual(res.body.documentation, '/api/docs');
  });

  // Verifies Swagger JSON specification availability.
  test('GET /api/docs/json should return 200 with OpenAPI 3.0 specification', async () => {
    const res = await request(app).get('/api/docs/json');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.openapi, '3.0.0');
    assert.strictEqual(res.body.info.title, 'Vmedia Enterprise Backend API');
  });

  // Verifies Swagger UI HTML endpoint.
  test('GET /api/docs/ should serve interactive Swagger UI documentation', async () => {
    const res = await request(app).get('/api/docs/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('Swagger UI') || res.text.includes('swagger-ui'));
  });

  // Verifies Hello World API success case.
  test('GET /api/v1/hello should return 200 with structured greeting payload', async () => {
    const res = await request(app).get('/api/v1/hello');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.statusCode, 200);
    assert.ok(res.body.data.greeting.includes('Hello from Vmedia'));
    assert.strictEqual(res.body.data.platform, 'Vmedia Platform');
    assert.ok(res.headers['x-request-id']);
  });

  // Verifies health check including a live Neon Postgres connection.
  test('GET /api/v1/health should return 200 when Neon Postgres is reachable', async () => {
    const res = await request(app).get('/api/v1/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.status, 'UP');
    assert.strictEqual(res.body.data.services.database.provider, 'Neon Postgres');
    assert.strictEqual(res.body.data.services.database.connected, true);
    assert.ok(typeof res.body.data.system.nodeVersion === 'string');
    assert.ok(res.body.data.system.memory.heapUsedMb > 0);
  });

  // Verifies failure case: 404 for undefined routes.
  test('GET /api/v1/undefined-endpoint should return 404 Not Found standardized error', async () => {
    const res = await request(app).get('/api/v1/undefined-endpoint');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.statusCode, 404);
    assert.ok(res.body.message.includes('The requested resource was not found'));
    assert.ok(res.headers['x-request-id']);
  });

  // Verifies failure case: malformed JSON never becomes an HTML error page.
  test('POST malformed JSON should return 400 standardized error', async () => {
    const res = await request(app)
      .post('/api/v1/hello')
      .set('Content-Type', 'application/json')
      .send('{"broken"');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.statusCode, 400);
  });

  // Verifies failure case: unsupported HTTP method.
  test('POST /api/v1/hello should return 404 since only GET is registered', async () => {
    const res = await request(app).post('/api/v1/hello').send({ data: 'test' });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });
});
