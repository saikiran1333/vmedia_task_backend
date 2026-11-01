import app from './src/app.js';
import { env } from './src/config/env.js';
import { closeDatabasePool, verifyDatabaseConnection } from './src/config/database.js';
import { logger } from './src/utils/logger.js';

// Starts HTTP server instance listening on configured port.
const server = app.listen(env.PORT, async () => {
  logger.info(`Vmedia backend server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  logger.info(`Swagger API documentation available at http://localhost:${env.PORT}/api/docs`);
  logger.info(`Base API prefix mounted at http://localhost:${env.PORT}${env.API_PREFIX}`);

  logger.debug('Testing Neon Postgres connectivity on startup');
  await verifyDatabaseConnection();
});

// Handles graceful shutdown sequence closing active socket connections.
const handleGracefulShutdown = (signal) => {
  logger.warn(`Received ${signal}. Commencing graceful shutdown sequence.`);
  server.close(async () => {
    try {
      await closeDatabasePool();
      logger.info('HTTP server closed and database pool drained. Exiting process safely.');
      process.exit(0);
    } catch (error) {
      logger.error('Failed while closing the database pool', { message: error.message });
      process.exit(1);
    }
  });

  // Forces termination if lingering connections do not resolve within 10 seconds.
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Forcing process termination.');
    process.exit(1);
  }, 10000).unref();
};

// Subscribes to process termination signals.
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

// Catches unhandled asynchronous promise rejections.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection detected', { reason: reason?.message || reason });
});

// Catches unhandled synchronous exceptions.
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception detected. Terminating process.', { message: error.message, stack: error.stack });
  process.exit(1);
});
