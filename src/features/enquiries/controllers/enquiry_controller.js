import { validateEnquiry } from '../enquiry_rules.js';
import { EnquiryService } from '../services/enquiry_service.js';
import { ApiResponse } from '../../../utils/api_response.js';
import { AppError } from '../../../utils/app_error.js';
import { HTTP_STATUS } from '../../../constants/http_status.js';
import { asyncHandler } from '../../../middleware/async_handler.js';

export class EnquiryController {
  static create = asyncHandler(async (req, res, next) => {
    const validation = validateEnquiry(req.body, req.get('Idempotency-Key'));
    if (!validation.ok) {
      return next(new AppError('Enquiry could not be saved.', HTTP_STATUS.BAD_REQUEST, validation.errors));
    }
    const result = await EnquiryService.create(validation.value);
    return ApiResponse.success(res, {
      statusCode: result.replay ? HTTP_STATUS.OK : HTTP_STATUS.CREATED,
      message: result.replay ? 'Enquiry already recorded.' : 'Enquiry received.',
      data: result.enquiry,
    });
  });
}
