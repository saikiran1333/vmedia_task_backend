import { ApiResponse } from '../utils/api_response.js';
import { HTTP_STATUS } from '../constants/http_status.js';
import { RESPONSE_MESSAGES } from '../constants/response_messages.js';
import { logger } from '../utils/logger.js';

// Centralized error boundary transforming exceptions into uniform JSON contracts.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = err.message || RESPONSE_MESSAGES.INTERNAL_ERROR;

  logger.error(`Error processing ${req.method} ${req.originalUrl}: ${message}`, {
    requestId: req.id,
    statusCode,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    details: err.details || null,
  });

  return ApiResponse.error(res, {
    statusCode,
    message,
    errors: process.env.NODE_ENV === 'development' ? { stack: err.stack, details: err.details } : err.details,
  });
};
