import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { HTTP_STATUS } from '../constants/http_status.js';
import { RESPONSE_MESSAGES } from '../constants/response_messages.js';

// IP-based sliding window rate limiter mitigating denial-of-service attempts.
export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    message: RESPONSE_MESSAGES.RATE_LIMIT_EXCEEDED,
    timestamp: new Date().toISOString(),
  },
});
