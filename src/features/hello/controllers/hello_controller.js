import { HelloService } from '../services/hello_service.js';
import { ApiResponse } from '../../../utils/api_response.js';
import { HTTP_STATUS } from '../../../constants/http_status.js';
import { RESPONSE_MESSAGES } from '../../../constants/response_messages.js';
import { logger } from '../../../utils/logger.js';

// Hello controller delegating requests to service layer and dispatching API responses.
export class HelloController {
  // Handles GET /api/v1/hello.
  static getHelloWorld(req, res, next) {
    try {
      logger.debug('Handling GET /hello in HelloController', { requestId: req.id });
      const data = HelloService.getGreeting();
      return ApiResponse.success(res, {
        statusCode: HTTP_STATUS.OK,
        message: RESPONSE_MESSAGES.HELLO_WORLD,
        data,
      });
    } catch (error) {
      logger.error('Failed to process HelloController.getHelloWorld', { error: error.message });
      next(error);
    }
  }
}
