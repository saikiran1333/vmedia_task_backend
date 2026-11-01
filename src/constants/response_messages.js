// Centralized system and response message constants.
export const RESPONSE_MESSAGES = Object.freeze({
  SUCCESS: 'Operation completed successfully.',
  SERVER_HEALTHY: 'Vmedia backend service is healthy and operational.',
  SERVER_DEGRADED: 'Vmedia backend is up, but Neon Postgres is unreachable.',
  HELLO_WORLD: 'Hello from Vmedia Enterprise Backend!',
  ROUTE_NOT_FOUND: 'The requested resource was not found on this server.',
  INTERNAL_ERROR: 'An unexpected internal server error occurred.',
  RATE_LIMIT_EXCEEDED: 'Too many requests from this IP. Please try again later.',
  DATABASE_CONNECTED: 'Neon Postgres connection verified successfully.',
  DATABASE_DISCONNECTED: 'Failed to verify Neon Postgres connection.',
});
