import { HealthService } from '../services/health_service.js';
import { ApiResponse } from '../../../utils/api_response.js';
import { HTTP_STATUS } from '../../../constants/http_status.js';
import { RESPONSE_MESSAGES } from '../../../constants/response_messages.js';
import { logger } from '../../../utils/logger.js';

// Health controller providing liveness and readiness diagnostic endpoints.
export class HealthController {
  // Handles GET /api/v1/health.
  static async getHealth(req, res, next) {
    try {
      logger.debug('Handling GET /health request in HealthController', { requestId: req.id });
      const healthData = await HealthService.checkHealth();
      if (healthData.status !== 'UP') {
        logger.warn('Health check degraded', {
          requestId: req.id,
          database: healthData.services.database.error,
        });
        return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
          success: false,
          statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
          message: RESPONSE_MESSAGES.SERVER_DEGRADED,
          data: healthData,
          errors: { database: healthData.services.database.error },
          timestamp: new Date().toISOString(),
        });
      }
      logger.debug('Health check passed', {
        requestId: req.id,
        latencyMs: healthData.services.database.latencyMs,
      });
      return ApiResponse.success(res, {
        statusCode: HTTP_STATUS.OK,
        message: RESPONSE_MESSAGES.SERVER_HEALTHY,
        data: healthData,
      });
    } catch (error) {
      logger.error('Health check inspection failed', { error: error.message });
      next(error);
    }
  }
}
