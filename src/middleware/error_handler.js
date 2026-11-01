import { ApiResponse } from '../utils/api_response.js';
import { HTTP_STATUS } from '../constants/http_status.js';
import { RESPONSE_MESSAGES } from '../constants/response_messages.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const fieldErrors = (err) => (Array.isArray(err.details) ? err.details : null);

// Centralized error boundary transforming exceptions into uniform JSON contracts.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return ApiResponse.error(res, {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      message: 'Request body must be valid JSON.',
      errors: [{ field: 'body', message: 'Request body must be valid JSON.' }],
    });
  }

  if (err.type === 'entity.too.large') {
    return ApiResponse.error(res, {
      statusCode: HTTP_STATUS.PAYLOAD_TOO_LARGE,
      message: 'Request body is too large.',
      errors: [{ field: 'body', message: 'Request body is too large.' }],
    });
  }

  const operational = err.isOperational === true;
  const statusCode = operational
    ? err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
    : HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = operational ? err.message || RESPONSE_MESSAGES.INTERNAL_ERROR : RESPONSE_MESSAGES.INTERNAL_ERROR;

  logger.error(`Error processing ${req.method} ${req.originalUrl}: ${message}`, {
    requestId: req.id,
    statusCode,
    code: err.code,
    stack: env.NODE_ENV === 'development' && statusCode >= 500
      ? String(err.stack || '').replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://redacted')
      : undefined,
  });

  return ApiResponse.error(res, {
    statusCode,
    message,
    errors: operational ? fieldErrors(err) : null,
  });
};
