import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.js';
import { swaggerSpec } from './docs/swagger_spec.js';
import { requestLogger } from './middleware/request_logger.js';
import { apiRateLimiter } from './middleware/rate_limiter.js';
import { notFoundHandler } from './middleware/not_found_handler.js';
import { errorHandler } from './middleware/error_handler.js';
import apiRouter from './routes/index.js';
import { logger } from './utils/logger.js';

// Initializes express application instance.
const app = express();

// Security headers hardening via helmet.
app.use(helmet());

// Cross-origin resource sharing policy.
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
    credentials: env.CORS_ORIGIN !== '*',
  })
);

// Payload gzip compression for optimized network transmission.
app.use(compression());

// Body parsers for JSON and URL-encoded payloads.
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// Request tracing and performance duration logging.
app.use(requestLogger);

// Raw OpenAPI 3.0 JSON specification endpoint.
app.get('/api/docs/json', (req, res) => {
  res.json(swaggerSpec);
});

// Swagger interactive API documentation gateway.
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Root ping endpoint providing top-level service metadata.
app.get('/', (req, res) => {
  res.json({
    name: 'Vmedia Backend API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: `${env.API_PREFIX}`,
    timestamp: new Date().toISOString(),
  });
});

// Applies sliding window rate limiting to all API v1 endpoints.
app.use(env.API_PREFIX, apiRateLimiter);

// Mounts modular feature routes under configured API prefix.
logger.debug(`Mounting central API router under prefix: ${env.API_PREFIX}`);
app.use(env.API_PREFIX, apiRouter);

// Catches unhandled routes and routes control to error pipeline.
app.use(notFoundHandler);

// Centralized error handler boundary.
app.use(errorHandler);

export default app;
