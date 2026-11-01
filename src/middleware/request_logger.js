import crypto from 'crypto';
import { logger } from '../utils/logger.js';

// Injects unique request identifier and measures execution latency.
export const requestLogger = (req, res, next) => {
  const requestId = crypto.randomUUID();
  const startTime = process.hrtime.bigint();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  logger.debug(`Incoming ${req.method} request to ${req.originalUrl}`, {
    requestId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Intercepts response finish event to calculate elapsed execution time.
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    logger.info(`${req.method} ${req.originalUrl} responded with ${res.statusCode} in ${durationMs.toFixed(2)}ms`, {
      requestId,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  next();
};
