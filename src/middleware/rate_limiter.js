import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { HTTP_STATUS } from '../constants/http_status.js';
import { RESPONSE_MESSAGES } from '../constants/response_messages.js';
import { ApiResponse } from '../utils/api_response.js';

// Shared 429 envelope. The timestamp is created when the limit is hit.
export const rateLimitHandler = (req, res) => {
  ApiResponse.error(res, {
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    message: RESPONSE_MESSAGES.RATE_LIMIT_EXCEEDED,
    errors: null,
  });
};

const limiter = (max) =>
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });

// IP-based sliding window rate limiter mitigating denial-of-service attempts.
export const apiRateLimiter = limiter(env.RATE_LIMIT_MAX_REQUESTS);

// Stricter caps for credential checks and public enquiry writes.
export const loginRateLimiter = limiter(env.LOGIN_RATE_LIMIT_MAX);
export const enquiryRateLimiter = limiter(env.ENQUIRY_RATE_LIMIT_MAX);
