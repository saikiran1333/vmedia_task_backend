import { AdminAuthService } from '../services/admin_auth_service.js';
import { ApiResponse } from '../../../utils/api_response.js';
import { HTTP_STATUS } from '../../../constants/http_status.js';
import { asyncHandler } from '../../../middleware/async_handler.js';

export class AdminAuthController {
  static login = asyncHandler(async (req, res) => {
    const result = await AdminAuthService.login(req.body);
    return ApiResponse.success(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Signed in.',
      data: result,
    });
  });

  static me = asyncHandler(async (req, res) => {
    return ApiResponse.success(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Success',
      data: req.admin,
    });
  });
}
