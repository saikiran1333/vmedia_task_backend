import { test, describe } from 'node:test';
import assert from 'node:assert';
import { toDriverConnectionString } from '../src/config/database.js';

describe('Neon connection string for node-postgres', () => {
  test('empty url stays empty', () => {
    assert.strictEqual(toDriverConnectionString(''), '');
  });

  test('strips channel_binding and pins sslmode to verify-full', () => {
    const raw =
      'postgresql://neondb_owner:secret@ep-example-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
    const url = new URL(toDriverConnectionString(raw));
    assert.strictEqual(url.searchParams.get('channel_binding'), null);
    assert.strictEqual(url.searchParams.get('sslmode'), 'verify-full');
    assert.strictEqual(url.username, 'neondb_owner');
    assert.ok(url.hostname.includes('-pooler'));
  });
});
