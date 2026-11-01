import { pool } from '../config/database.js';
import { AppError } from '../utils/app_error.js';
import { HTTP_STATUS } from '../constants/http_status.js';
import { mapDatabaseError } from './errors.js';

export const assertDatabaseConfigured = () => {
  if (!pool) {
    throw new AppError('The database is unavailable. Try again in a moment.', HTTP_STATUS.SERVICE_UNAVAILABLE);
  }
};

export const dbQuery = async (text, params = []) => {
  assertDatabaseConfigured();
  try {
    return await pool.query(text, params);
  } catch (error) {
    throw mapDatabaseError(error);
  }
};
