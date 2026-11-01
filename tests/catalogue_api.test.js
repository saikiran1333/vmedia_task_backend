import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'test-only-jwt-secret-not-for-production-use';
}

import app from '../src/app.js';
import { pool } from '../src/config/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalogue } from '../src/db/seed.js';
import { ENQUIRY_BUDGETS } from '../src/constants/catalogue.js';

const ADMIN_EMAIL = 'catalogue-test-admin@example.com';
const DISABLED_EMAIL = 'catalogue-test-disabled@example.com';
const PASSWORD = 'test-password-1';

const enquiryBody = (overrides = {}) => ({
  name: 'Asha Rao',
  email: `catalogue-test-${randomUUID()}@example.com`,
  phone: '9876543210',
  city: 'Pune',
  companyName: 'Northwind Gifts',
  occasion: 'Corporate Diwali Gifting',
  budget: ENQUIRY_BUDGETS[5],
  message: 'We need branded gifts for the Diwali dispatch.',
  source: 'WEBSITE',
  units: 10,
  ...overrides,
});

describe('catalogue and enquiry API', { concurrency: false, timeout: 300000 }, () => {
  let token;

  before(async () => {
    assert.ok(pool, 'DATABASE_URL is required for catalogue tests');
    await runMigrations();
    await seedCatalogue();
    const summary = await seedCatalogue();
    assert.ok(summary.products >= 8);

    await pool.query(`DELETE FROM enquiries WHERE email LIKE 'catalogue-test-%@example.com'`);
    await pool.query(`DELETE FROM admin_users WHERE email LIKE 'catalogue-test-%@example.com'`);
    await pool.query(`DELETE FROM products WHERE id LIKE 'tg-test-%'`);

    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    await pool.query(
      `INSERT INTO admin_users (email, name, password_hash, role) VALUES ($1, 'Test Admin', $2, 'admin')`,
      [ADMIN_EMAIL, passwordHash]
    );
    await pool.query(
      `INSERT INTO admin_users (email, name, password_hash, role, disabled_at)
       VALUES ($1, 'Disabled Admin', $2, 'admin', now())`,
      [DISABLED_EMAIL, passwordHash]
    );
    await pool.query(
      `INSERT INTO products (
         id, slug, name, description, displayed_price_paise, currency, budget_band,
         just_in, fast_selling, active, created_at, updated_at, source_url
       ) VALUES (
         'tg-test-inactive', 'tg-test-inactive', 'Inactive Test Product', 'Not a public product.',
         10000, 'INR', 'Under ₹500', false, false, false, now(), now(), 'https://example.invalid/inactive'
       )`
    );

    const login = await request(app).post('/api/v1/admin/auth/login').send({ email: ADMIN_EMAIL, password: PASSWORD });
    assert.strictEqual(login.status, 200);
    token = login.body.data.token;
  });

  after(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM enquiries WHERE email LIKE 'catalogue-test-%@example.com'`);
    await pool.query(`DELETE FROM admin_users WHERE email LIKE 'catalogue-test-%@example.com'`);
    await pool.query(`DELETE FROM products WHERE id LIKE 'tg-test-%'`);
  });

  test('seed is idempotent and restores a changed product name', async () => {
    const beforeCount = await pool.query('SELECT COUNT(*)::int AS total FROM products WHERE id LIKE \'tg-%\' AND id NOT LIKE \'tg-test-%\'');
    const imagesBefore = await pool.query(
      `SELECT COUNT(*)::int AS total FROM product_images WHERE product_id NOT LIKE 'tg-test-%'`
    );
    await pool.query(`UPDATE products SET name = 'TEMP NAME' WHERE id = 'tg-7831'`);
    await seedCatalogue();
    const restored = await pool.query('SELECT name, displayed_price_paise FROM products WHERE id = $1', ['tg-7831']);
    const imagesAfter = await pool.query(
      `SELECT COUNT(*)::int AS total FROM product_images WHERE product_id NOT LIKE 'tg-test-%'`
    );
    assert.strictEqual(restored.rows[0].name, 'Caslay Organic Polo T-Shirt');
    assert.strictEqual(restored.rows[0].displayed_price_paise, 95000);
    assert.strictEqual(imagesAfter.rows[0].total, imagesBefore.rows[0].total);
    assert.ok(beforeCount.rows[0].total >= 8);
  });

  test('lists, filters, sorts, and paginates active products', async () => {
    const all = await request(app).get('/api/v1/products?pageSize=50');
    assert.strictEqual(all.status, 200);
    assert.ok(all.body.meta.total >= 8);
    assert.ok(all.body.data.every((product) => product.imageKey && product.imageKey.startsWith('products/')));
    assert.ok(all.body.data.every((product) => product.occasions.length >= 1));
    assert.ok(all.body.data.every((product) => product.customisationOptions.includes('Logo printing')));
    assert.ok(!all.body.data.some((product) => product.id === 'tg-test-inactive'));
    assert.ok(!JSON.stringify(all.body).includes('tribegreengifts.com'));

    const drinkware = await request(app).get('/api/v1/products').query({ category: 'Drinkware' });
    assert.ok(drinkware.body.data.every((product) => product.category === 'Drinkware'));
    assert.ok(drinkware.body.data.some((product) => product.id === 'tg-6819'));

    const budget = await request(app).get('/api/v1/products').query({ budget: 'Under ₹500' });
    assert.ok(budget.body.data.every((product) => product.budgetBand === 'Under ₹500'));
    assert.ok(budget.body.meta.total >= 1);

    const search = await request(app).get('/api/v1/products').query({ q: 'polo' });
    assert.ok(search.body.data.some((product) => product.id === 'tg-7831'));

    const combined = await request(app).get('/api/v1/products').query({ category: 'Apparel', budget: 'Under ₹500' });
    assert.strictEqual(combined.status, 200);
    assert.strictEqual(combined.body.meta.total, 0);
    assert.strictEqual(combined.body.message, 'No products match.');

    const occasion = await request(app).get('/api/v1/products').query({ occasion: 'Employee Onboarding', pageSize: 5 });
    assert.strictEqual(occasion.status, 200);
    assert.ok(occasion.body.meta.total >= 8);
    assert.strictEqual(occasion.body.data.length, 5);

    const page = await request(app).get('/api/v1/products').query({ sort: 'price', order: 'asc', page: 1, pageSize: 1 });
    assert.strictEqual(page.body.data.length, 1);
    assert.strictEqual(page.body.data[0].displayedPrice, 255);

    const invalid = await request(app).get('/api/v1/products').query({ sort: 'drop table' });
    assert.strictEqual(invalid.status, 400);
    assert.ok(invalid.body.errors.some((error) => error.field === 'sort'));
  });

  test('returns product detail and rejects invalid, missing, and inactive ids', async () => {
    const detail = await request(app).get('/api/v1/products/tg-7831');
    assert.strictEqual(detail.status, 200);
    assert.strictEqual(detail.body.data.name, 'Caslay Organic Polo T-Shirt');
    assert.strictEqual(detail.body.data.displayedPrice, 950);
    assert.strictEqual(detail.body.data.originalPrice, 2299);
    assert.strictEqual(detail.body.data.category, 'Apparel');
    assert.strictEqual(detail.body.data.shortDescription, null);
    assert.ok(detail.body.data.galleryKeys.length >= 1);
    assert.strictEqual(detail.body.data.imageKey, 'products/caslay-organic-polo-t-shirt-01.webp');

    const invalid = await request(app).get('/api/v1/products/drop-table');
    assert.strictEqual(invalid.status, 400);

    const missing = await request(app).get('/api/v1/products/tg-999999');
    assert.strictEqual(missing.status, 404);
    assert.strictEqual(missing.body.message, 'Product not found.');

    const inactive = await request(app).get('/api/v1/products/tg-test-inactive');
    assert.strictEqual(inactive.status, 404);
    assert.strictEqual(inactive.body.message, 'This product is not available.');
  });

  test('returns categories, occasions, and customisation options from the database', async () => {
    const categories = await request(app).get('/api/v1/categories');
    assert.deepStrictEqual(categories.body.data.map((row) => row.name), [
      'Drinkware',
      'Apparel',
      'Work Essentials',
      'Wellness',
    ]);
    assert.ok(categories.body.data.every((row) => Number.isInteger(row.productCount)));

    const occasions = await request(app).get('/api/v1/occasions');
    assert.strictEqual(occasions.body.data.filter((row) => row.catalogueFilter).length, 6);
    assert.ok(occasions.body.data.some((row) => row.enquiryLabel === 'Branded Merchandise / Promotional Gifts' && row.catalogueFilter === false));

    const options = await request(app).get('/api/v1/customisation-options');
    assert.deepStrictEqual(options.body.data.map((row) => row.name), [
      'Logo printing',
      'Laser engraving',
      'Name personalisation',
    ]);
  });

  test('creates an enquiry from item quantities inside one transaction', async () => {
    const created = await request(app).post('/api/v1/enquiries').send(enquiryBody({
      units: undefined,
      items: [
        { productId: 'tg-7831', quantity: 2 },
        { productId: 'tg-6657', quantity: 3 },
      ],
      customisationOptions: ['Logo printing'],
      source: 'MOBILE',
    }));
    assert.strictEqual(created.status, 201);
    assert.strictEqual(created.body.data.units, 5);
    assert.strictEqual(created.body.data.status, 'NEW');
    assert.strictEqual(created.body.data.source, 'MOBILE');
    assert.match(created.body.data.enquiryNumber, /^ENQ-\d{8}-\d{4}$/);

    const stored = await pool.query(
      `SELECT product_name, quantity, unit_price_paise
       FROM enquiry_items WHERE enquiry_id = $1 ORDER BY product_id`,
      [created.body.data.id]
    );
    assert.strictEqual(stored.rowCount, 2);
    assert.strictEqual(stored.rows[0].quantity, 3);
    assert.strictEqual(stored.rows[0].unit_price_paise, 25500);
    assert.strictEqual(stored.rows[1].product_name, 'Caslay Organic Polo T-Shirt');
    assert.strictEqual(stored.rows[1].unit_price_paise, 95000);
  });

  test('rejects a client total that does not match quantities, and invalid products', async () => {
    const mismatch = await request(app).post('/api/v1/enquiries').send(enquiryBody({
      units: 9,
      items: [{ productId: 'tg-7831', quantity: 2 }],
    }));
    assert.strictEqual(mismatch.status, 400);
    assert.ok(mismatch.body.errors.some((error) => error.field === 'units'));

    const missing = await request(app).post('/api/v1/enquiries').send(enquiryBody({
      units: undefined,
      items: [{ productId: 'tg-999999', quantity: 1 }],
    }));
    assert.strictEqual(missing.status, 400);
    assert.ok(missing.body.errors.some((error) => error.field === 'items'));

    const inactive = await request(app).post('/api/v1/enquiries').send(enquiryBody({
      units: undefined,
      items: [{ productId: 'tg-test-inactive', quantity: 1 }],
    }));
    assert.strictEqual(inactive.status, 400);
    assert.match(inactive.body.errors[0].message, /not available/);

    const badEmail = await request(app).post('/api/v1/enquiries').send(enquiryBody({ email: 'nope' }));
    assert.strictEqual(badEmail.status, 400);
    assert.ok(badEmail.body.errors.some((error) => error.field === 'email'));
  });

  test('returns the original enquiry when the same idempotency key is retried', async () => {
    const key = `retry-${randomUUID()}`;
    const body = enquiryBody();
    const first = await request(app).post('/api/v1/enquiries').set('Idempotency-Key', key).send(body);
    const second = await request(app).post('/api/v1/enquiries').set('Idempotency-Key', key).send(body);
    assert.strictEqual(first.status, 201);
    assert.strictEqual(second.status, 200);
    assert.strictEqual(second.body.data.id, first.body.data.id);
    assert.strictEqual(second.body.message, 'Enquiry already recorded.');

    const count = await pool.query('SELECT COUNT(*)::int AS total FROM enquiries WHERE id = $1', [first.body.data.id]);
    assert.strictEqual(count.rows[0].total, 1);

    const conflict = await request(app).post('/api/v1/enquiries').set('Idempotency-Key', key).send(enquiryBody());
    assert.strictEqual(conflict.status, 409);
  });

  test('rolls back an enquiry when an item insert fails', async () => {
    const client = await pool.connect();
    const number = `ENQ-TEST-${randomUUID().slice(0, 8)}`;
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO enquiries (
           enquiry_number, name, email, phone, city, units, occasion_label, budget_label, message, source
         ) VALUES ($1, 'Rollback', 'catalogue-test-rollback@example.com', '+919876543210', 'Pune', 1,
           'Corporate Diwali Gifting', $2, 'This rollback must not remain.', 'WEBSITE')
         RETURNING id`,
        [number, ENQUIRY_BUDGETS[5]]
      );
      await assert.rejects(
        client.query(
          `INSERT INTO enquiry_items (enquiry_id, product_id, product_name, quantity, unit_price_paise)
           VALUES ($1, 'tg-does-not-exist', 'Missing', 1, 100)`,
          [inserted.rows[0].id]
        )
      );
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    const leftover = await pool.query('SELECT id FROM enquiries WHERE enquiry_number = $1', [number]);
    assert.strictEqual(leftover.rowCount, 0);
  });

  test('protects admin routes and manages enquiry status and CSV export', async () => {
    const anonymous = await request(app).get('/api/v1/admin/enquiries');
    assert.strictEqual(anonymous.status, 401);
    assert.strictEqual(anonymous.body.message, 'Sign in required.');

    const wrong = await request(app).post('/api/v1/admin/auth/login').send({ email: ADMIN_EMAIL, password: 'wrong-password' });
    assert.strictEqual(wrong.status, 401);
    assert.strictEqual(wrong.body.message, 'Email or password is incorrect.');

    const disabled = await request(app).post('/api/v1/admin/auth/login').send({ email: DISABLED_EMAIL, password: PASSWORD });
    assert.strictEqual(disabled.status, 403);

    const me = await request(app).get('/api/v1/admin/auth/me').set('Authorization', `Bearer ${token}`);
    assert.strictEqual(me.status, 200);
    assert.strictEqual(me.body.data.email, ADMIN_EMAIL);
    assert.strictEqual(JSON.stringify(me.body).includes('password'), false);

    const otherRole = jwt.sign({ sub: me.body.data.id, role: 'user' }, process.env.JWT_SECRET, {
      expiresIn: '1h',
      issuer: 'vmedia-backend',
      audience: 'vmedia-admin',
    });
    const forbidden = await request(app).get('/api/v1/admin/auth/me').set('Authorization', `Bearer ${otherRole}`);
    assert.strictEqual(forbidden.status, 403);

    const created = await request(app).post('/api/v1/enquiries').send(enquiryBody({
      name: '=1+1',
      message: 'A gift note for "Café" नमस्ते team.',
      companyName: 'North, "Wind"',
    }));
    assert.strictEqual(created.status, 201);

    const list = await request(app)
      .get('/api/v1/admin/enquiries')
      .query({ source: 'WEBSITE', status: 'NEW', q: created.body.data.enquiryNumber })
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(list.status, 200);
    assert.ok(list.body.data.items.some((item) => item.id === created.body.data.id));
    assert.strictEqual(list.body.data.items[0].message, undefined);

    const detail = await request(app)
      .get(`/api/v1/admin/enquiries/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(detail.status, 200);
    assert.strictEqual(detail.body.data.message, 'A gift note for "Café" नमस्ते team.');
    assert.strictEqual(detail.body.data.statusEvents[0].toStatus, 'NEW');

    const updated = await request(app)
      .patch(`/api/v1/admin/enquiries/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CONTACTED' });
    assert.strictEqual(updated.status, 200);
    assert.strictEqual(updated.body.data.status, 'CONTACTED');
    assert.ok(updated.body.data.statusEvents.some((event) => event.fromStatus === 'NEW' && event.toStatus === 'CONTACTED'));

    const badStatus = await request(app)
      .patch(`/api/v1/admin/enquiries/${created.body.data.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'closed' });
    assert.strictEqual(badStatus.status, 400);

    const missingEnquiry = await request(app)
      .get(`/api/v1/admin/enquiries/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(missingEnquiry.status, 404);

    const exported = await request(app)
      .get('/api/v1/admin/enquiries/export')
      .query({ q: created.body.data.enquiryNumber, status: 'CONTACTED' })
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(exported.status, 200);
    assert.match(exported.headers['content-type'], /text\/csv/);
    assert.ok(exported.text.charCodeAt(0) === 0xfeff);
    assert.match(exported.text, /Enquiry Number/);
    assert.match(exported.text, /'=1\+1/);
    assert.match(exported.text, /नमस्ते/);
    assert.match(exported.text, /"North, ""Wind"""/);

    const unauthenticatedExport = await request(app).get('/api/v1/admin/enquiries/export');
    assert.strictEqual(unauthenticatedExport.status, 401);
    assert.strictEqual(unauthenticatedExport.body.success, false);
  });

  test('a disabled admin token cannot call protected routes', async () => {
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const inserted = await pool.query(
      `INSERT INTO admin_users (email, name, password_hash, role)
       VALUES ($1, 'Soon Disabled', $2, 'admin') RETURNING id`,
      [`catalogue-test-${randomUUID()}@example.com`, passwordHash]
    );
    const signed = jwt.sign({ sub: inserted.rows[0].id, role: 'admin' }, process.env.JWT_SECRET, {
      expiresIn: '1h',
      issuer: 'vmedia-backend',
      audience: 'vmedia-admin',
    });
    await pool.query('UPDATE admin_users SET disabled_at = now() WHERE id = $1', [inserted.rows[0].id]);
    const response = await request(app).get('/api/v1/admin/auth/me').set('Authorization', `Bearer ${signed}`);
    assert.strictEqual(response.status, 403);
    assert.match(response.body.message, /disabled/);
  });
});
