import { test, describe } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import { resolveUnits, normalizeIndianMobile, validateEnquiry } from '../src/features/enquiries/enquiry_rules.js';
import { csvCell, csvLine } from '../src/features/enquiries/csv.js';
import { paiseToRupees, rupeesToPaise } from '../src/utils/money.js';
import { toAssetKey } from '../src/db/seed.js';
import { mapDatabaseError } from '../src/db/errors.js';
import { errorHandler } from '../src/middleware/error_handler.js';
import { rateLimitHandler } from '../src/middleware/rate_limiter.js';
import { ENQUIRY_BUDGETS } from '../src/constants/catalogue.js';
import rateLimit from 'express-rate-limit';

describe('catalogue rules', () => {
  test('converts rupees and paise without a float drift for seed prices', () => {
    assert.strictEqual(rupeesToPaise(950), 95000);
    assert.strictEqual(paiseToRupees(95000), 950);
    assert.strictEqual(rupeesToPaise(null), null);
    assert.strictEqual(paiseToRupees(307100), 3071);
  });

  test('asset keys drop the /assets prefix used by the web client', () => {
    assert.strictEqual(
      toAssetKey('/assets/products/neck-pillow-with-travel-case-01.webp'),
      'products/neck-pillow-with-travel-case-01.webp'
    );
    assert.throws(() => toAssetKey('https://tribegreengifts.com/photo.webp'), /not under \/assets/);
  });

  test('calculates gift units from item quantities and rejects a conflicting total', () => {
    const items = [
      { productId: 'tg-7831', quantity: 2 },
      { productId: 'tg-6657', quantity: 3 },
    ];
    assert.deepStrictEqual(resolveUnits(items, null), { units: 5 });
    assert.deepStrictEqual(resolveUnits(items, 5), { units: 5 });
    assert.strictEqual(resolveUnits(items, 9).error.includes('sum'), true);
    assert.deepStrictEqual(resolveUnits([], 12), { units: 12 });
  });

  test('accepts Indian mobiles and rejects other numbers', () => {
    assert.strictEqual(normalizeIndianMobile('9876543210'), '+919876543210');
    assert.strictEqual(normalizeIndianMobile('+91 98765 43210'), '+919876543210');
    assert.strictEqual(normalizeIndianMobile('09876543210'), '+919876543210');
    assert.strictEqual(normalizeIndianMobile('1234567890'), null);
    assert.strictEqual(normalizeIndianMobile('98765'), null);
  });

  test('rejects an enquiry that is missing required fields and a bad email', () => {
    const result = validateEnquiry({
      name: 'A',
      email: 'not-an-email',
      phone: '1234567890',
      city: '',
      occasion: 'Party',
      budget: 'Under ₹500',
      message: 'short',
      source: 'WEB',
    });
    assert.strictEqual(result.ok, false);
    const fields = result.errors.map((error) => error.field);
    for (const field of ['name', 'email', 'phone', 'city', 'occasion', 'budget', 'message', 'source', 'units']) {
      assert.ok(fields.includes(field), field);
    }
  });

  test('accepts a general enquiry and normalises the occasion label', () => {
    const result = validateEnquiry({
      name: 'Asha Rao',
      email: 'ASHA@Example.com',
      phone: '9876543210',
      city: 'Pune',
      occasion: 'Employee Onboarding',
      budget: ENQUIRY_BUDGETS[0],
      message: 'We need onboarding kits for the new team.',
      source: 'MOBILE',
      units: 20,
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.value.email, 'asha@example.com');
    assert.strictEqual(result.value.phone, '+919876543210');
    assert.strictEqual(result.value.occasionLabel, 'Employee Joining Kit / Onboarding');
    assert.strictEqual(result.value.suppliedUnits, 20);
  });

  test('rejects a message that is too long and a past delivery date', () => {
    const longMessage = 'a'.repeat(2001);
    const result = validateEnquiry({
      name: 'Asha Rao',
      email: 'asha@example.com',
      phone: '9876543210',
      city: 'Pune',
      occasion: 'Corporate Diwali Gifting',
      budget: ENQUIRY_BUDGETS[5],
      message: longMessage,
      source: 'WEBSITE',
      units: 4,
      deliveryDate: '2020-01-01',
      customisationOptions: ['Gold plating'],
    });
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some((error) => error.field === 'message'));
    assert.ok(result.errors.some((error) => error.field === 'deliveryDate'));
    assert.ok(result.errors.some((error) => error.field === 'customisationOptions'));
  });

  test('escapes CSV formulas, quotes, and unicode', () => {
    assert.strictEqual(csvCell('=1+1'), "'=1+1");
    assert.strictEqual(csvCell('He said "hello"'), '"He said ""hello"""');
    assert.strictEqual(csvCell('नमस्ते'), 'नमस्ते');
    assert.strictEqual(csvCell(null), '');
    assert.ok(csvLine(['=cmd', 'plain']).startsWith("'=cmd,plain"));
  });

  test('maps database outages without returning the driver message', () => {
    const timeout = mapDatabaseError(Object.assign(new Error('timeout exceeded when trying to connect'), { code: 'ETIMEDOUT' }));
    assert.strictEqual(timeout.statusCode, 503);
    assert.match(timeout.message, /timed out/i);
    assert.strictEqual(timeout.message.includes('ETIMEDOUT'), false);
    assert.strictEqual(timeout.message.includes('trying to connect'), false);

    const down = mapDatabaseError(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));
    assert.strictEqual(down.statusCode, 503);
    assert.match(down.message, /unavailable/i);
  });

  test('hides unexpected errors and reports invalid JSON', async () => {
    const app = express();
    app.use(express.json());
    app.get('/boom', () => {
      throw new Error('postgres://user:password@internal/db');
    });
    app.use(errorHandler);

    const failure = await request(app).get('/boom');
    assert.strictEqual(failure.status, 500);
    assert.strictEqual(failure.body.success, false);
    assert.strictEqual(failure.body.errors, null);
    assert.strictEqual(JSON.stringify(failure.body).includes('password'), false);

    const broken = await request(app)
      .post('/boom')
      .set('Content-Type', 'application/json')
      .send('{"broken"');
    assert.strictEqual(broken.status, 400);
    assert.strictEqual(broken.body.errors[0].field, 'body');
  });

  test('rate limit responses use the standard envelope', async () => {
    const app = express();
    app.use(rateLimit({ windowMs: 60_000, max: 1, handler: rateLimitHandler, standardHeaders: true, legacyHeaders: false }));
    app.get('/', (req, res) => res.json({ ok: true }));
    await request(app).get('/');
    const limited = await request(app).get('/');
    assert.strictEqual(limited.status, 429);
    assert.strictEqual(limited.body.success, false);
    assert.strictEqual(limited.body.errors, null);
    assert.match(limited.body.message, /Too many requests/);
  });
});
