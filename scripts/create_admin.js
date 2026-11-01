import bcrypt from 'bcryptjs';
import { createDirectPool } from '../src/config/database.js';

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const name = (process.env.ADMIN_NAME || '').trim();

if (!email || !password || !name) {
  console.error('Set ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME in the environment.');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
  console.error('ADMIN_EMAIL is not a valid email address.');
  process.exit(1);
}
if (password.length < 12 || password.length > 200) {
  console.error('ADMIN_PASSWORD must be between 12 and 200 characters.');
  process.exit(1);
}
if (name.length < 2 || name.length > 80) {
  console.error('ADMIN_NAME must be between 2 and 80 characters.');
  process.exit(1);
}

const direct = createDirectPool();
if (!direct) {
  console.error('DATABASE_URL is not configured.');
  process.exit(1);
}

try {
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await direct.query('SELECT id FROM admin_users WHERE email = $1', [email]);
  if (existing.rowCount) {
    await direct.query(
      `UPDATE admin_users
       SET name = $2, password_hash = $3, disabled_at = NULL
       WHERE email = $1`,
      [email, name, passwordHash]
    );
    console.log(`Updated admin ${email}.`);
  } else {
    const inserted = await direct.query(
      `INSERT INTO admin_users (email, name, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id`,
      [email, name, passwordHash]
    );
    console.log(`Created admin ${email} (${inserted.rows[0].id}).`);
  }
} catch (error) {
  console.error(error.code ? `Admin account was not saved (${error.code}).` : 'Admin account was not saved.');
  process.exitCode = 1;
} finally {
  await direct.end();
}
