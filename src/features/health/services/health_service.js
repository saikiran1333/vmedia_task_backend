import { verifyDatabaseConnection } from '../../../config/database.js';
import { logger } from '../../../utils/logger.js';

// Health service inspecting process liveness and Neon Postgres connectivity.
export class HealthService {
  static async checkHealth() {
    logger.debug('Executing HealthService.checkHealth diagnostic check');
    const dbStatus = await verifyDatabaseConnection();
    const memoryUsage = process.memoryUsage();

    return {
      status: dbStatus.connected ? 'UP' : 'DEGRADED',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: {
          provider: 'Neon Postgres',
          connected: dbStatus.connected,
          database: dbStatus.database || null,
          latencyMs: dbStatus.latencyMs ?? null,
          error: dbStatus.connected ? null : dbStatus.error || 'Database unreachable',
        },
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
        memory: {
          rssMb: Number((memoryUsage.rss / 1024 / 1024).toFixed(2)),
          heapUsedMb: Number((memoryUsage.heapUsed / 1024 / 1024).toFixed(2)),
          heapTotalMb: Number((memoryUsage.heapTotal / 1024 / 1024).toFixed(2)),
        },
      },
    };
  }
};
