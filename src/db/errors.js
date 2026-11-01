import { AppError } from '../utils/app_error.js';
import { HTTP_STATUS } from '../constants/http_status.js';
import { RESPONSE_MESSAGES } from '../constants/response_messages.js';
import { logger } from '../utils/logger.js';

const UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ECONNRESET',
  'EAI_AGAIN',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '57P01',
  '57P03',
  '53300',
  '08P01',
]);

// Maps driver failures onto the public error envelope. Connection strings stay in the log code only.
export const mapDatabaseError = (error) => {
  if (error instanceof AppError) return error;

  const code = error?.code || '';
  const message = error?.message || '';
  const timedOut = code === 'ETIMEDOUT' || code === '57014' || /timeout/i.test(message);

  if (timedOut) {
    return new AppError(
      'The database connection timed out. Try again in a moment.',
      HTTP_STATUS.SERVICE_UNAVAILABLE
    );
  }

  if (UNAVAILABLE_CODES.has(code) || /connection terminated|econnrefused|the database system is/i.test(message)) {
    return new AppError(
      'The database is unavailable. Try again in a moment.',
      HTTP_STATUS.SERVICE_UNAVAILABLE
    );
  }

  logger.error('Database query failed', { code: code || 'unknown' });
  return new AppError(RESPONSE_MESSAGES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
};
