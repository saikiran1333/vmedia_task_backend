import jwt from 'jsonwebtoken';
import { AppError } from '../../utils/app_error.js';
import { HTTP_STATUS } from '../../constants/http_status.js';
import { env } from '../../config/env.js';

const issuer = 'vmedia-backend';
const audience = 'vmedia-admin';

const secret = () => {
  const value = process.env.JWT_SECRET || '';
  if (value.length < 32) {
    throw new AppError('Admin authentication is not configured.', HTTP_STATUS.SERVICE_UNAVAILABLE);
  }
  return value;
};

export const signAdminToken = (admin) =>
  jwt.sign({ sub: admin.id, role: 'admin' }, secret(), {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer,
    audience,
  });

export const verifyAdminToken = (token) => {
  try {
    const payload = jwt.verify(token, secret(), { issuer, audience });
    if (!payload || typeof payload.sub !== 'string') {
      throw new AppError('Sign in required.', HTTP_STATUS.UNAUTHORIZED);
    }
    if (payload.role !== 'admin') {
      throw new AppError('You do not have access to this resource.', HTTP_STATUS.FORBIDDEN);
    }
    return payload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Sign in required.', HTTP_STATUS.UNAUTHORIZED);
  }
};
