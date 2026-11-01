import bcrypt from 'bcryptjs';
import { dbQuery } from '../../../db/query.js';
import { AppError } from '../../../utils/app_error.js';
import { HTTP_STATUS } from '../../../constants/http_status.js';
import { signAdminToken } from '../admin_token.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-admin-password', 10);

const publicAdmin = (row) => ({
  id: row.id,
  email: row.email,
  name: row.name,
});

export class AdminAuthService {
  static async login(body) {
    const email = body && typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body && typeof body.password === 'string' ? body.password : '';
    const errors = [];
    if (!email || !EMAIL_PATTERN.test(email)) {
      errors.push({ field: 'email', message: 'Enter the admin email address.' });
    }
    if (!password || password.length > 200) {
      errors.push({ field: 'password', message: 'Enter the admin password.' });
    }
    if (errors.length) {
      throw new AppError('The request is not valid.', HTTP_STATUS.BAD_REQUEST, errors);
    }

    const result = await dbQuery(
      `SELECT id, email, name, password_hash, role, disabled_at
       FROM admin_users WHERE email = $1`,
      [email]
    );
    const admin = result.rows[0];
    const hash = admin?.password_hash || DUMMY_PASSWORD_HASH;
    const matches = await bcrypt.compare(password, hash);
    if (!admin || !matches) {
      throw new AppError('Email or password is incorrect.', HTTP_STATUS.UNAUTHORIZED);
    }
    if (admin.disabled_at) {
      throw new AppError('This admin account is disabled.', HTTP_STATUS.FORBIDDEN);
    }
    if (admin.role !== 'admin') {
      throw new AppError('You do not have access to this resource.', HTTP_STATUS.FORBIDDEN);
    }

    return {
      token: signAdminToken(admin),
      admin: publicAdmin(admin),
    };
  }

  static async findById(id) {
    const result = await dbQuery(
      `SELECT id, email, name, role, disabled_at FROM admin_users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }
}
