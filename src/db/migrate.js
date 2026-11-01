import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createDirectPool } from '../config/database.js';
import { logger } from '../utils/logger.js';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

const withDirectClient = async (work) => {
  const direct = createDirectPool();
  if (!direct) {
    throw new Error('DATABASE_URL is not configured.');
  }
  const client = await direct.connect();
  try {
    return await work(client);
  } finally {
    client.release();
    await direct.end();
  }
};

// Applies SQL files in filename order. A file that was already applied is skipped.
// Editing an applied file is rejected so production schema is not silently rewritten.
export const runMigrations = async () => {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const applied = [];
  await withDirectClient(async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version text PRIMARY KEY,
          checksum text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      for (const fileName of files) {
        const version = fileName.replace(/\.sql$/, '');
        const sql = fs.readFileSync(path.join(migrationsDir, fileName), 'utf8');
        const checksum = crypto.createHash('sha256').update(sql).digest('hex');
        const existing = await client.query(
          'SELECT checksum FROM schema_migrations WHERE version = $1',
          [version]
        );

        if (existing.rowCount > 0) {
          if (existing.rows[0].checksum !== checksum) {
            throw new Error(
              `Migration ${version} was already applied with a different checksum. Add a new migration file.`
            );
          }
          continue;
        }

        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
          [version, checksum]
        );
        applied.push(version);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  logger.info(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Database migrations already applied');
  return applied;
};
