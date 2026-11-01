import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

// node-postgres does not implement libpq channel_binding. Neon connection
// strings often include it; leaving it in the URL makes pg reject the string.
export const toDriverConnectionString = (rawUrl) => {
  if (!rawUrl) return '';
  const url = new URL(rawUrl);
  url.searchParams.delete('channel_binding');
  // pg treats sslmode=require as verify-full today and warns that this will change.
  // Pin verify-full so the current certificate check stays explicit.
  if (url.searchParams.get('sslmode') === 'require') {
    url.searchParams.set('sslmode', 'verify-full');
  }
  return url.toString();
};

const connectionString = toDriverConnectionString(env.DATABASE_URL);

export const pool = connectionString
  ? new Pool({
      connectionString,
      max: env.DB_POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
      allowExitOnIdle: true,
      ssl: { rejectUnauthorized: true },
    })
  : null;

if (pool) {
  pool.on('error', (error) => {
    logger.error('Unexpected Neon pool error on idle client', { message: error.message });
  });
}

export const verifyDatabaseConnection = async () => {
  if (!pool) {
    logger.error('DATABASE_URL is missing. Neon Postgres is not configured.');
    return {
      connected: false,
      provider: 'Neon Postgres',
      error: 'DATABASE_URL is not configured.',
    };
  }

  const started = Date.now();
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      'SELECT current_database() AS database, current_user AS db_user, NOW() AS server_time'
    );
    const row = result.rows[0];
    const latencyMs = Date.now() - started;
    logger.info('Neon Postgres connection verified', {
      database: row.database,
      latencyMs,
    });
    return {
      connected: true,
      provider: 'Neon Postgres',
      database: row.database,
      user: row.db_user,
      serverTime: row.server_time,
      latencyMs,
    };
  } catch (error) {
    logger.error('Failed to verify Neon Postgres connection', { message: error.message });
    return {
      connected: false,
      provider: 'Neon Postgres',
      latencyMs: Date.now() - started,
      error: error.message,
    };
  } finally {
    if (client) client.release();
  }
};

export const closeDatabasePool = async () => {
  if (pool) {
    await pool.end();
  }
};
